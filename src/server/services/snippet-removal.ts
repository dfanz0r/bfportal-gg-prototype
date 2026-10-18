import { and, eq, inArray, isNull } from 'drizzle-orm'

import { REMOVE_NOTE_NEEDED } from '../../shared/decision'
import { type Refusal, refuse } from '../../shared/results'
import { isStaff } from '../../shared/roles'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { revisions, snippets } from '../db/schema'
import type { Executor } from './shared'
import { lockSnippetEdits } from './snippet-edits'

// Ending a snippet, as an experience is ended: its owner deleting their own,
// or a moderator removing one for spam or something badly wrong. Neither
// erases the row. A deleted one is hidden everywhere, its owner's list
// included; a removed one is hidden from everyone else, and its owner sees
// that it was removed and why. See "Submission states" in PLAN.md.

/** An edit waiting on it goes with it: nobody is to review an edit to nothing. */
const dropPendingEdits = (executor: Executor, snippetId: number) =>
  executor
    .delete(revisions)
    .where(
      and(eq(revisions.snippetId, snippetId), eq(revisions.status, 'pending')),
    )

/** The snippet at `slug`, if it is there, held still while it is ended. */
async function heldSnippet(tx: Executor, slug: string) {
  const [found] = await tx
    .select({ id: snippets.id })
    .from(snippets)
    .where(and(eq(snippets.slug, slug), isNull(snippets.deletedAt)))
  if (!found) return null
  // As a moderator deciding on its edit takes it, so one waits for the other.
  await lockSnippetEdits(tx, found.id)
  return found
}

/**
 * Deletes one of the actor's own snippets, whatever its state. Only its owner
 * may: a moderator removes one instead, with a note.
 */
export async function deleteOwnSnippet(
  actor: Actor | null,
  slug: string,
  now = new Date(),
): Promise<{ ok: true } | Refusal> {
  if (!actor) return refuse('signed-out')
  return db.transaction(async (tx) => {
    const found = await heldSnippet(tx, slug)
    if (!found) return refuse('not-found')
    const [deleted] = await tx
      .update(snippets)
      .set({ deletedAt: now })
      .where(
        and(
          eq(snippets.id, found.id),
          eq(snippets.ownerId, actor.id),
          isNull(snippets.deletedAt),
        ),
      )
      .returning({ id: snippets.id })
    // Someone else's is not theirs to delete, nor to know about.
    if (!deleted) return refuse('not-found')
    await dropPendingEdits(tx, deleted.id)
    return { ok: true as const }
  })
}

/**
 * Removes a snippet for good, with a note to its owner: for spam or something
 * badly wrong. Only a moderator or an admin may. It cannot be sent in again.
 */
export async function removeSnippet(
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
    const found = await heldSnippet(tx, slug)
    if (!found) return refuse('not-found')
    const [removed] = await tx
      .update(snippets)
      .set({
        status: 'removed',
        reviewedBy: actor.id,
        reviewedAt: now,
        reviewNote: written,
        // Off every list at once.
        featured: false,
        trending: false,
      })
      .where(
        and(
          eq(snippets.id, found.id),
          inArray(snippets.status, [
            'pending',
            'changes_requested',
            'published',
            'unpublished',
          ]),
          isNull(snippets.deletedAt),
        ),
      )
      .returning({ id: snippets.id })
    if (!removed) return refuse('not-found')
    await dropPendingEdits(tx, removed.id)
    return { ok: true as const }
  })
}
