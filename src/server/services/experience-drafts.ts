import { and, count, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'

import {
  experienceFormSchema,
  formErrors,
  MAX_CREDITS,
  MAX_MEDIA,
} from '../../shared/experience-form'
import { gameInfo } from '../../shared/games'
import { MAX_ADDED_FILES } from '../../shared/project-files'
import { type Refusal, refuse } from '../../shared/results'
import { slugify } from '../../shared/slug'
import { MAX_TEAMS } from '../../shared/teams'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { categories, experiences } from '../db/schema'
import { renderMarkdown } from '../markdown'
import { DRAFT_LIMIT, discardDraft } from './drafts'
import { lastSentEdit } from './experience-edits'
import { heldIdsIn, keepFilesWithDraft, letGoOfDraftFiles } from './held-files'
import { type Executor, violates } from './shared'

// An experience saved without being submitted: a draft, which only its owner
// sees. Saving takes the form as it is, half filled in or not; submitting it
// later is where everything is checked. See "Submission states" in PLAN.md.

/**
 * How many drafts one account may keep. Each is space here, so it is counted
 * under a lock on the account, in the same transaction as the write.
 */
export const MAX_DRAFTS = 20

/** The experience form's own fields, which are all a draft keeps. */
const FIELDS = Object.keys(experienceFormSchema.shape)

type FieldName = keyof typeof experienceFormSchema.shape

/**
 * How much of each field a draft keeps: the same limits the form holds a
 * submission to, in characters and, for a list, in entries. Whatever else a
 * draft lets slide, it does not store more than a submission could. Every
 * field of the form is here, or this does not compile.
 */
const SIZES: Record<FieldName, { chars: number; items?: number }> = {
  editing: { chars: 200 },
  game: { chars: 20 },
  code: { chars: 20 },
  link: { chars: 500 },
  category: { chars: 80 },
  title: { chars: 80 },
  description: { chars: 10_000 },
  tags: { chars: 80, items: 30 },
  built: { chars: 20, items: 4 },
  isTemplate: { chars: 10 },
  copyAllowed: { chars: 10 },
  teamPlayers: { chars: 5, items: MAX_TEAMS },
  teamBots: { chars: 5, items: MAX_TEAMS },
  coverImgUrl: { chars: 500 },
  media: { chars: 500, items: MAX_MEDIA },
  files: { chars: 36, items: MAX_ADDED_FILES + 1 },
  repoUrl: { chars: 500 },
  filesUrl: { chars: 500 },
  credits: { chars: 60, items: MAX_CREDITS },
  creditAccounts: { chars: 25, items: MAX_CREDITS },
}

/** What in a draft's fields is more than it may keep, by field. */
function oversized(fields: Record<string, string | string[]>) {
  const errors: Record<string, string> = {}
  for (const [name, value] of Object.entries(fields)) {
    const size = SIZES[name as FieldName]
    if (!size) continue
    // One value where a list is taken is a list of one.
    const values = [value].flat()
    const most = size.items ?? 1
    if (values.length > most) {
      errors[name] = most === 1 ? 'Only one is taken.' : `Up to ${most}.`
    } else if (values.some((item) => item.length > size.chars)) {
      errors[name] = `Keep it to ${size.chars} characters.`
    }
  }
  return errors
}

/**
 * What a draft must be before it is saved: a title, a category, and nothing
 * that would be unsafe to keep. Every link is checked as on submit, and text
 * is held to the same length. The rest is kept as typed and checked on submit.
 */
const draftSchema = experienceFormSchema.pick({
  editing: true,
  game: true,
  title: true,
  category: true,
  description: true,
  coverImgUrl: true,
  media: true,
  repoUrl: true,
  filesUrl: true,
  credits: true,
})

/**
 * What its owner opens in the form: a draft, one sent back with changes
 * requested, one waiting for review, which they may change and send again,
 * and one that is live, which they change by an edit a moderator approves.
 */
export const EDITABLE = [
  'draft',
  'changes_requested',
  'pending',
  'published',
] as const

/** Those whose row is not what a moderator reviews, so saving writes to it. */
const UNSENT = ['draft', 'changes_requested'] as const

/** Live: changed by an edit beside the page, not on the row itself. */
export const isLive = (status: string) => status === 'published'

/**
 * One of theirs to go on with in the form, by its address, or null: a draft,
 * one sent back, one waiting for review, or one that is live.
 */
export async function ownEditable(
  actor: Actor,
  slug: string,
  executor: Executor = db,
) {
  const [found] = await executor
    .select({
      id: experiences.id,
      slug: experiences.slug,
      game: experiences.game,
      status: experiences.status,
      title: experiences.title,
      descriptionMd: experiences.descriptionMd,
      coverImgUrl: experiences.coverImgUrl,
      isTemplate: experiences.isTemplate,
      copyAllowed: experiences.copyAllowed,
      code: experiences.code,
      playgroundId: experiences.playgroundId,
      teamSetup: experiences.teamSetup,
      types: experiences.types,
      repoUrl: experiences.repoUrl,
      filesUrl: experiences.filesUrl,
      reviewNote: experiences.reviewNote,
      category: categories.slug,
      draftForm: experiences.draftForm,
      updatedAt: experiences.updatedAt,
    })
    .from(experiences)
    .innerJoin(categories, eq(categories.id, experiences.categoryId))
    .where(
      and(
        eq(experiences.slug, slug),
        eq(experiences.ownerId, actor.id),
        inArray(experiences.status, EDITABLE),
        isNull(experiences.deletedAt),
      ),
    )
    .limit(1)
  return found ?? null
}

export type Editable = NonNullable<Awaited<ReturnType<typeof ownEditable>>>

/** A form's own fields, as text: what a draft keeps of what was sent. */
function keptFields(given: Record<string, unknown>) {
  const fields: Record<string, string | string[]> = {}
  for (const name of FIELDS) {
    const value = given[name]
    if (typeof value === 'string') fields[name] = value
    else if (Array.isArray(value)) {
      fields[name] = value.filter((item) => typeof item === 'string')
    }
  }
  return fields
}

/**
 * Saves the experience form as a draft for whoever is acting: a new one, or
 * the one in its `editing` field. Its files are saved with it, and held for
 * as long as it is a draft.
 */
export async function saveExperienceDraft(
  actor: Actor | null,
  given: Record<string, unknown>,
  now = new Date(),
): Promise<{ ok: true; slug: string } | Refusal> {
  if (!actor) return refuse('signed-out')
  const fields = keptFields(given)
  const tooMuch = oversized(fields)
  if (Object.keys(tooMuch).length > 0) return refuse('invalid', tooMuch)
  // And the whole of it, which every field at its most stays well under.
  if (JSON.stringify(fields).length > DRAFT_LIMIT) {
    return refuse('invalid', { form: 'That is more than a draft keeps.' })
  }
  const read = draftSchema.safeParse(fields)
  if (!read.success) return refuse('invalid', formErrors(read.error))
  const form = read.data
  const draft = form.editing ? await ownEditable(actor, form.editing) : null
  if (form.editing && !draft) return refuse('not-found')
  const game = draft?.game ?? form.game
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.kind, 'experience_main'),
        eq(categories.slug, form.category),
        eq(categories.visible, true),
        eq(categories.selectableOnForm, true),
        or(isNull(categories.game), eq(categories.game, game)),
      ),
    )
    .limit(1)
  if (!category) {
    return refuse('invalid', {
      category: 'Choose one of the categories offered.',
    })
  }

  // What its page shows while it is a draft. Everything else waits in the
  // form until it is submitted.
  const values = {
    title: form.title,
    categoryId: category.id,
    descriptionMd: form.description,
    descriptionHtml: renderMarkdown(form.description),
    coverImgUrl: form.coverImgUrl ?? null,
    isTemplate: gameInfo(game).hasExport && fields.isTemplate === 'true',
    draftForm: { fields: { ...fields, game }, errors: {} },
  }
  const files = heldIdsIn(fields.files)

  if (draft) {
    // One waiting for review, or live, keeps what was sent: the moderator
    // reviews that. Only the form is saved, for its owner to send later.
    const sent = !UNSENT.some((status) => status === draft.status)
    return db.transaction(async (tx) => {
      // Saved as it is: a draft stays a draft, and one sent back stays sent
      // back until it is submitted again.
      const [saved] = await tx
        .update(experiences)
        .set(sent ? { draftForm: values.draftForm } : values)
        .where(
          and(
            eq(experiences.id, draft.id),
            eq(experiences.status, draft.status),
            // Still there: deleted in another tab since it was read, it is
            // not saved into.
            isNull(experiences.deletedAt),
          ),
        )
        .returning({ id: experiences.id })
      if (!saved) return refuse('not-found')
      // A live one's edit, waiting or sent back, still names the files it
      // was sent with. One in review was stored as sent, so its saved form
      // is all that names any. Read after the row is held: an edit sent
      // meanwhile has finished, and what it names is seen.
      const sentEdit = isLive(draft.status)
        ? await lastSentEdit(draft.id, tx)
        : null
      await keepFilesWithDraft(tx, actor, draft.id, files, now, {
        alsoKeep: sentEdit?.form.files,
      })
      await discardDraft(tx, actor)
      return { ok: true as const, slug: draft.slug }
    })
  }

  // A new one gets an address from its title, as a submission does.
  const base = slugify(form.title) || 'experience'
  const taken = await db
    .select({ slug: experiences.slug })
    .from(experiences)
    .where(like(experiences.slug, `${base}%`))
  const used = new Set(taken.map((row) => row.slug))
  for (let attempt = 0; ; attempt += 1) {
    let slug = base
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`
    try {
      return await db.transaction(async (tx) => {
        // Two saves at once from one account wait here, one for the other.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`drafts:${actor.id}`}, 0))`,
        )
        const [{ value: drafts }] = await tx
          .select({ value: count() })
          .from(experiences)
          .where(
            and(
              eq(experiences.ownerId, actor.id),
              eq(experiences.status, 'draft'),
              isNull(experiences.deletedAt),
            ),
          )
        if (drafts >= MAX_DRAFTS) {
          return refuse('invalid', {
            form: `You have ${drafts} drafts, the most you can keep. Submit or delete one first.`,
          })
        }
        const [created] = await tx
          .insert(experiences)
          .values({
            ...values,
            slug,
            game,
            status: 'draft',
            ownerId: actor.id,
            submittedAt: now,
          })
          .returning({ id: experiences.id })
        await keepFilesWithDraft(tx, actor, created.id, files, now)
        await discardDraft(tx, actor)
        return { ok: true as const, slug }
      })
    } catch (error) {
      if (!violates(error, 'experiences_slug_unique') || attempt >= 10) {
        throw error
      }
      used.add(slug)
    }
  }
}

/**
 * Deletes one of their drafts. The row stays, hidden everywhere, as any
 * deleted experience does; its files are let go.
 */
export async function deleteExperienceDraft(
  actor: Actor | null,
  slug: string,
  now = new Date(),
): Promise<{ ok: true } | Refusal> {
  if (!actor) return refuse('signed-out')
  const draft = await ownEditable(actor, slug)
  // Only a draft is deleted here; something sent in has been seen.
  if (draft?.status !== 'draft') return refuse('not-found')
  await db.transaction(async (tx) => {
    await tx
      .update(experiences)
      .set({ deletedAt: now, draftForm: null })
      .where(eq(experiences.id, draft.id))
    await letGoOfDraftFiles(tx, draft.id)
  })
  return { ok: true }
}
