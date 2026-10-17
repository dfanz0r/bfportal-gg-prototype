import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { gameInfo } from '../../shared/games'
import { type Refusal, refuse } from '../../shared/results'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experiences, projectFiles, revisions } from '../db/schema'
import type { Executor } from './shared'

// Offering an experience's files as a template, or no longer offering them,
// after it was submitted. Its files are kept either way; this decides who may
// download them. Taking the offer back is immediate. Making it on something
// published waits for a moderator, as an edit: anyone could download the
// files from then on.

/**
 * What a pending edit asks to change. Only what is written here is ever
 * applied, so nothing else a payload holds can reach the page.
 */
export const editPayloadSchema = z.object({
  isTemplate: z.boolean().optional(),
})

export type EditPayload = z.infer<typeof editPayloadSchema>

const pendingEdit = (experienceId: number) =>
  and(
    eq(revisions.experienceId, experienceId),
    eq(revisions.kind, 'edit'),
    eq(revisions.status, 'pending'),
  )

/**
 * Offers the experience at `slug` as a template, or stops offering it. Only
 * its owner may, and only where its game's Portal exports files: elsewhere a
 * template is a category.
 *
 * `offered`: it is a template now. `requested`: a moderator is asked first.
 * `withdrawn`: it is not one, and any request to make it one is taken back.
 */
export async function offerAsTemplate(
  actor: Actor | null,
  slug: string,
  offer: boolean,
  now = new Date(),
): Promise<
  { ok: true; state: 'offered' | 'requested' | 'withdrawn' } | Refusal
> {
  if (!actor) return refuse('signed-out')
  const [found] = await db
    .select({
      id: experiences.id,
      game: experiences.game,
      status: experiences.status,
      ownerId: experiences.ownerId,
      isTemplate: experiences.isTemplate,
      filesUrl: experiences.filesUrl,
    })
    .from(experiences)
    .where(and(eq(experiences.slug, slug), isNull(experiences.deletedAt)))
    .limit(1)
  // Someone else's is not theirs to change, and not theirs to know about.
  if (!found || found.ownerId !== actor.id) return refuse('not-found')
  if (!gameInfo(found.game).hasExport) {
    return refuse('invalid', {
      form: `In ${gameInfo(found.game).name} a template is chosen by its category.`,
    })
  }

  return db.transaction(async (tx) => {
    // One change to an experience's edits at a time.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`edit:${found.id}`}, 0))`,
    )
    const [pending] = await tx
      .select({ id: revisions.id, payload: revisions.payload })
      .from(revisions)
      .where(pendingEdit(found.id))
      .limit(1)
    const asked = editPayloadSchema.catch({}).parse(pending?.payload)

    if (!offer) {
      await tx
        .update(experiences)
        .set({ isTemplate: false })
        .where(eq(experiences.id, found.id))
      if (pending && asked.isTemplate !== undefined) {
        const { isTemplate: _, ...rest } = asked
        if (Object.keys(rest).length === 0) {
          await tx.delete(revisions).where(eq(revisions.id, pending.id))
        } else {
          await tx
            .update(revisions)
            .set({ payload: rest })
            .where(eq(revisions.id, pending.id))
        }
      }
      return { ok: true as const, state: 'withdrawn' as const }
    }

    const [{ value: files }] = await tx
      .select({ value: count() })
      .from(projectFiles)
      .where(eq(projectFiles.experienceId, found.id))
    if (files === 0 && !found.filesUrl) {
      return refuse('invalid', { form: 'It has no files to offer.' })
    }
    if (found.isTemplate)
      return { ok: true as const, state: 'offered' as const }
    // Not published yet: a moderator reviews it, files and all, before
    // anyone else sees it, so there is nothing to ask.
    if (found.status !== 'published') {
      await tx
        .update(experiences)
        .set({ isTemplate: true })
        .where(eq(experiences.id, found.id))
      return { ok: true as const, state: 'offered' as const }
    }
    // An experience has one pending edit, which this joins.
    if (pending) {
      await tx
        .update(revisions)
        .set({ payload: { ...asked, isTemplate: true } })
        .where(eq(revisions.id, pending.id))
    } else {
      await tx.insert(revisions).values({
        experienceId: found.id,
        kind: 'edit',
        payload: { isTemplate: true },
        submittedBy: actor.id,
        submittedAt: now,
      })
    }
    return { ok: true as const, state: 'requested' as const }
  })
}

/**
 * Where its owner's last request to offer an experience as a template
 * stands: waiting, or sent back with a moderator's note. Null when there is
 * none, or the last was approved.
 */
export async function templateRequestOf(
  experienceId: number,
  executor: Executor = db,
) {
  const asking = await executor
    .select({
      status: revisions.status,
      payload: revisions.payload,
      reviewNote: revisions.reviewNote,
    })
    .from(revisions)
    .where(
      and(
        eq(revisions.experienceId, experienceId),
        eq(revisions.kind, 'edit'),
        sql`${revisions.payload} ->> 'isTemplate' is not null`,
      ),
    )
    .orderBy(desc(revisions.submittedAt), desc(revisions.id))
    .limit(1)
  const [last] = asking
  if (!last || last.status === 'approved') return null
  return last.status === 'pending'
    ? { waiting: true as const, note: null }
    : { waiting: false as const, note: last.reviewNote }
}
