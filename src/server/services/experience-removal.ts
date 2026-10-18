import { and, eq, inArray, isNull } from 'drizzle-orm'

import { REMOVE_NOTE_NEEDED } from '../../shared/decision'
import { type Refusal, refuse } from '../../shared/results'
import { isStaff } from '../../shared/roles'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experiences, projectFiles, revisions } from '../db/schema'
import { letGoOfDraftFiles } from './held-files'
import type { Executor } from './shared'

// Ending an experience: its owner deleting their own, or a moderator removing
// one for spam or something badly wrong. Neither erases the row. A deleted
// one is hidden everywhere, its owner's list included; a removed one is
// hidden from everyone else, and its owner sees that it was removed and why.
// See "Submission states" in PLAN.md.

/** Changes waiting on it go with it: nobody is to review an edit to nothing. */
const dropPendingEdits = (executor: Executor, experienceId: number) =>
  executor
    .delete(revisions)
    .where(
      and(
        eq(revisions.experienceId, experienceId),
        eq(revisions.status, 'pending'),
      ),
    )

/**
 * Deletes one of the actor's own experiences, whatever its state. Only its
 * owner may: a moderator removes one instead, with a note.
 */
export async function deleteOwnExperience(
  actor: Actor | null,
  slug: string,
  now = new Date(),
): Promise<{ ok: true } | Refusal> {
  if (!actor) return refuse('signed-out')
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .update(experiences)
      .set({ deletedAt: now, draftForm: null })
      .where(
        and(
          eq(experiences.slug, slug),
          eq(experiences.ownerId, actor.id),
          isNull(experiences.deletedAt),
        ),
      )
      .returning({ id: experiences.id })
    // Someone else's is not theirs to delete, nor to know about.
    if (!deleted) return refuse('not-found')
    await dropPendingEdits(tx, deleted.id)
    await letGoOfDraftFiles(tx, deleted.id)
    // Nobody can open its files now, so they are not kept: deleting is not a
    // way to store uploads out of sight.
    await tx
      .delete(projectFiles)
      .where(eq(projectFiles.experienceId, deleted.id))
    return { ok: true as const }
  })
}

/**
 * Removes an experience for good, with a note to its owner: for spam or
 * something badly wrong. Only a moderator or an admin may. It cannot be sent
 * in again. A draft has not been sent to anyone, so there is none to remove.
 */
export async function removeExperience(
  actor: Actor | null,
  slug: string,
  note: string,
  now = new Date(),
): Promise<{ ok: true } | Refusal> {
  if (!actor) return refuse('signed-out')
  if (!isStaff(actor.role)) return refuse('forbidden')
  const written = note.trim()
  // The owner is told why, so there must be a why.
  if (written.length < 3) return refuse('invalid', { note: REMOVE_NOTE_NEEDED })
  return db.transaction(async (tx) => {
    const [removed] = await tx
      .update(experiences)
      .set({
        status: 'removed',
        reviewedBy: actor.id,
        reviewedAt: now,
        reviewNote: written,
        // Off every list and out of every search at once.
        featured: false,
        trending: false,
      })
      .where(
        and(
          eq(experiences.slug, slug),
          inArray(experiences.status, [
            'pending',
            'changes_requested',
            'published',
            'unpublished',
          ]),
          isNull(experiences.deletedAt),
        ),
      )
      .returning({ id: experiences.id })
    if (!removed) return refuse('not-found')
    await dropPendingEdits(tx, removed.id)
    // It cannot be sent again, so what its owner saved to send goes too.
    await letGoOfDraftFiles(tx, removed.id)
    return { ok: true as const }
  })
}
