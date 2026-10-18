import { and, eq, inArray, isNull, like, sql } from 'drizzle-orm'

import { experienceFormSchema, formErrors } from '../../shared/experience-form'
import { type Refusal, refuse } from '../../shared/results'
import { slugify } from '../../shared/slug'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experiences } from '../db/schema'
import type { lookupExperience } from '../integrations/gametools'
import { renderMarkdown } from '../markdown'
import { discardDraft } from './drafts'
import { isLive, ownEditable } from './experience-drafts'
import { submitExperienceEdit } from './experience-edits'
import {
  letGoOfDraftFiles,
  letGoOfHeldFiles,
  takeHeldFiles,
} from './held-files'
import { prepareExperience, writeAround } from './prepare-experience'
import { type Executor, violates } from './shared'
import { resendLimit, submissionLimit, withinLimit } from './submission-limits'

// Sharing an experience. What is submitted waits as `pending` until a
// moderator approves it; nothing here publishes anything.

/** The experience form's own fields, which a refused one is kept by. */
export const EXPERIENCE_FIELDS = Object.keys(experienceFormSchema.shape)

/**
 * Sends the experience form for review, for whoever is acting: something
 * new, a draft, one sent back, or one already waiting, whose new version
 * takes the old one's place in the queue. For something live it is an edit,
 * which waits beside the live page: `submitExperienceEdit`.
 */
export async function submitExperience(
  actor: Actor | null,
  given: unknown,
  options: { lookup?: typeof lookupExperience; now?: Date } = {},
): Promise<{ ok: true; slug: string } | Refusal> {
  if (!actor) return refuse('signed-out')
  const parsed = experienceFormSchema.safeParse(given)
  if (!parsed.success) return refuse('invalid', formErrors(parsed.error))
  const form = parsed.data
  // One of theirs being sent in, rather than something new.
  const draft = form.editing ? await ownEditable(actor, form.editing) : null
  if (form.editing && !draft) return refuse('not-found')
  if (draft && isLive(draft.status)) {
    return submitExperienceEdit(actor, form, draft, options)
  }
  const now = options.now ?? new Date()

  // Every submission is a moderator's time, and a lookup on someone else's
  // service, so one over the limit is told before Portal is asked. The write
  // below is what holds to it. One already waiting is not another
  // submission: sending it again is held to its own limit.
  const resending = draft?.status === 'pending'
  const limited = resending
    ? resendLimit(actor)
    : await submissionLimit(actor, now)
  if (limited) return limited

  const ready = await prepareExperience(actor, form, draft, {
    lookup: options.lookup,
    now,
  })
  if (!ready.ok) return ready
  const { game, prepared, held } = ready

  // The address is the title, with a number after it if that is taken. What
  // was read above can be out of date by the time this writes: two people can
  // send the same title at once. The database is what knows, so a taken
  // address is found out by trying, and the next one is tried.
  const base = slugify(form.title) || 'experience'
  const taken = draft
    ? []
    : await db
        .select({ slug: experiences.slug })
        .from(experiences)
        .where(like(experiences.slug, `${base}%`))
  const used = new Set(taken.map((row) => row.slug))
  for (let attempt = 0; ; attempt += 1) {
    let slug = base
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`
    try {
      const write = async (tx: Executor) => {
        // The files read above, taken again before anything is written: one
        // let go since, by another form or by its day running out, means
        // this is not the submission its sender saw.
        const files =
          held.length > 0
            ? await takeHeldFiles(tx, actor, prepared.files, {
                now,
                draft: draft?.id,
              })
            : []
        if (files.length < held.length) {
          return refuse('invalid', {
            files: 'A file is no longer held. Add it again.',
          })
        }
        const values = {
          ...prepared.values,
          descriptionHtml: renderMarkdown(prepared.values.descriptionMd),
          game,
          status: 'pending' as const,
          ownerId: actor.id,
        }
        // A draft, or one sent back or waiting, becomes the submission at
        // the address it already has. What it had is replaced by what was
        // just checked, and its version moves on, so a decision on what was
        // there before is refused.
        const [created] = draft
          ? await tx
              .update(experiences)
              .set({
                ...values,
                // One waiting keeps its place in the queue.
                ...(resending ? {} : { submittedAt: now }),
                version: sql`${experiences.version} + 1`,
                draftForm: null,
                // The last decision was about what was sent before. What is
                // sent now waits for its own.
                reviewedBy: null,
                reviewedAt: null,
                reviewNote: null,
                reviewFieldNotes: {},
              })
              .where(
                and(
                  eq(experiences.id, draft.id),
                  inArray(experiences.status, [
                    'draft',
                    'changes_requested',
                    'pending',
                  ]),
                  // Still there: deleted since it was read, it is not
                  // submitted, and nothing reports that it was.
                  isNull(experiences.deletedAt),
                ),
              )
              .returning({ id: experiences.id })
          : await tx
              .insert(experiences)
              .values({ ...values, slug, submittedAt: now })
              .returning({ id: experiences.id })
        if (!created) return refuse('not-found')
        await writeAround(tx, created.id, actor.id, prepared, files)
        // It went through, so a kept copy of a refused form, and the files it
        // held, have done their job. Another form's files are its own.
        await discardDraft(tx, actor)
        await letGoOfHeldFiles(
          tx,
          actor,
          files.map((file) => file.id),
        )
        if (draft) await letGoOfDraftFiles(tx, draft.id)
        return { ok: true as const, slug: draft?.slug ?? slug }
      }
      return await withinLimit(actor, now, write, { counted: !resending })
    } catch (error) {
      if (!violates(error, 'experiences_slug_unique') || attempt >= 10) {
        throw error
      }
      used.add(slug)
    }
  }
}
