import { and, count, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'

import { experienceFormSchema, formErrors } from '../../shared/experience-form'
import { gameInfo } from '../../shared/games'
import { type Refusal, refuse } from '../../shared/results'
import { slugify } from '../../shared/slug'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { categories, experiences } from '../db/schema'
import { renderMarkdown } from '../markdown'
import { discardDraft } from './drafts'
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
 * What its owner edits in the form before it is sent: a draft, and one a
 * moderator sent back with changes requested. One in review waits for its
 * review; one that is live is changed by an edit a moderator approves.
 */
const EDITABLE = ['draft', 'changes_requested'] as const

/**
 * One of theirs to go on with in the form, by its address, or null: a draft,
 * or one sent back with changes requested.
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
    return db.transaction(async (tx) => {
      // Saved as it is: a draft stays a draft, and one sent back stays sent
      // back until it is submitted again.
      const [saved] = await tx
        .update(experiences)
        .set(values)
        .where(
          and(
            eq(experiences.id, draft.id),
            inArray(experiences.status, EDITABLE),
          ),
        )
        .returning({ id: experiences.id })
      if (!saved) return refuse('not-found')
      await keepFilesWithDraft(tx, actor, draft.id, files, now)
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
