import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { type Refusal, refuse } from '../../shared/results'
import type { SnippetForm } from '../../shared/snippet-form'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { categories, revisions, snippets } from '../db/schema'
import { renderMarkdown } from '../markdown'
import { discardDraft } from './drafts'
import { editPayloadSchema, type PreparedSnippet } from './edit-payload'
import type { EditChange } from './experience-edits'
import type { Executor } from './shared'
import { resendLimit } from './submission-limits'

// Changing a snippet after it was sent, as an experience is changed: one in
// review or sent back is sent again in place, and one that is live waits as
// its one pending edit beside the live page, which sending again replaces.

/**
 * What its owner opens in the form: one sent back, one waiting for review,
 * and one that is live. Snippets have no drafts.
 */
export const SNIPPET_EDITABLE = [
  'changes_requested',
  'pending',
  'published',
] as const

/** One of the actor's snippets to change, by its address, or null. */
export async function ownSnippet(actor: Actor, slug: string) {
  const [found] = await db
    .select({
      id: snippets.id,
      slug: snippets.slug,
      status: snippets.status,
      title: snippets.title,
      descriptionMd: snippets.descriptionMd,
      script: snippets.script,
      category: categories.slug,
      reviewNote: snippets.reviewNote,
    })
    .from(snippets)
    .leftJoin(categories, eq(categories.id, snippets.categoryId))
    .where(
      and(
        eq(snippets.slug, slug),
        eq(snippets.ownerId, actor.id),
        inArray(snippets.status, SNIPPET_EDITABLE),
        isNull(snippets.deletedAt),
      ),
    )
    .limit(1)
  return found ?? null
}

export type OwnSnippet = NonNullable<Awaited<ReturnType<typeof ownSnippet>>>

/** A snippet's one pending edit. */
const pendingSnippetEdit = (snippetId: number) =>
  and(
    eq(revisions.snippetId, snippetId),
    eq(revisions.kind, 'edit'),
    eq(revisions.status, 'pending'),
  )

/**
 * Holds a snippet and its edits still until the transaction ends: its lock,
 * then its row, before any revision, as `lockEdits` does for an experience.
 */
export async function lockSnippetEdits(tx: Executor, snippetId: number) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`snippet-edit:${snippetId}`}, 0))`,
  )
  await tx
    .select({ id: snippets.id })
    .from(snippets)
    .where(eq(snippets.id, snippetId))
    .for('update')
}

/**
 * Sends the snippet form as an edit to one of the actor's live snippets. It
 * waits beside the page as the snippet's one pending edit; sending again
 * replaces what it asks for and moves its version on.
 */
export async function submitSnippetEdit(
  actor: Actor,
  form: SnippetForm,
  live: OwnSnippet,
  categoryId: number,
  now = new Date(),
): Promise<{ ok: true; slug: string } | Refusal> {
  const limited = resendLimit(actor)
  if (limited) return limited
  const snippet: PreparedSnippet = {
    title: form.title,
    descriptionMd: form.description,
    categoryId,
    script: form.script,
  }
  return db.transaction(async (tx) => {
    await lockSnippetEdits(tx, live.id)
    const [still] = await tx
      .select({ id: snippets.id })
      .from(snippets)
      .where(
        and(
          eq(snippets.id, live.id),
          eq(snippets.ownerId, actor.id),
          eq(snippets.status, 'published'),
          isNull(snippets.deletedAt),
        ),
      )
    if (!still) return refuse('not-found')
    const [pending] = await tx
      .select({ id: revisions.id })
      .from(revisions)
      .where(pendingSnippetEdit(live.id))
      .limit(1)
    if (pending) {
      await tx
        .update(revisions)
        .set({
          payload: { snippet },
          submittedBy: actor.id,
          version: sql`${revisions.version} + 1`,
        })
        .where(eq(revisions.id, pending.id))
    } else {
      await tx.insert(revisions).values({
        snippetId: live.id,
        kind: 'edit',
        payload: { snippet },
        submittedBy: actor.id,
        submittedAt: now,
      })
    }
    await discardDraft(tx, actor)
    return { ok: true as const, slug: live.slug }
  })
}

/** Writes an approved edit to the live snippet. */
export async function applySnippetEdit(
  tx: Executor,
  snippetId: number,
  snippet: PreparedSnippet | undefined,
  now: Date,
) {
  if (!snippet) return
  await tx
    .update(snippets)
    .set({
      ...snippet,
      descriptionHtml: renderMarkdown(snippet.descriptionMd),
      lastPublishedAt: now,
    })
    .where(eq(snippets.id, snippetId))
}

/**
 * The edit its owner last sent to a live snippet, waiting or sent back, with
 * the moderator's note on one sent back. Null when there is none, or the last
 * was approved. The form opens on it.
 */
export async function lastSentSnippetEdit(snippetId: number) {
  const [last] = await db
    .select({
      status: revisions.status,
      payload: revisions.payload,
      reviewNote: revisions.reviewNote,
    })
    .from(revisions)
    .where(and(eq(revisions.snippetId, snippetId), eq(revisions.kind, 'edit')))
    .orderBy(desc(revisions.submittedAt), desc(revisions.id))
    .limit(1)
  if (!last || last.status === 'approved') return null
  const snippet = editPayloadSchema.catch({}).parse(last.payload).snippet
  if (!snippet) return null
  const [category] = await db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, snippet.categoryId))
  return {
    waiting: last.status === 'pending',
    note: last.status === 'changes_requested' ? last.reviewNote : null,
    fields: {
      title: snippet.title,
      description: snippet.descriptionMd,
      script: snippet.script,
      category: category?.slug ?? '',
    },
  }
}

/** What an edit to a snippet changes, beside what is live, field by field. */
export async function describeSnippetEdit(
  snippetId: number,
  snippet: PreparedSnippet | undefined,
) {
  if (!snippet) return { changes: [], unchanged: [] }
  const [live] = await db
    .select({
      title: snippets.title,
      descriptionMd: snippets.descriptionMd,
      script: snippets.script,
      categoryId: snippets.categoryId,
    })
    .from(snippets)
    .where(eq(snippets.id, snippetId))
  const categoryRows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      inArray(
        categories.id,
        [live.categoryId, snippet.categoryId].filter(
          (id): id is number => id !== null,
        ),
      ),
    )
  const categoryName = (id: number | null) =>
    categoryRows.find((row) => row.id === id)?.name ?? 'None'
  const compared: EditChange[] = [
    { field: 'Title', live: live.title, proposed: snippet.title },
    {
      field: 'Description',
      live: live.descriptionMd || 'None',
      proposed: snippet.descriptionMd || 'None',
      long: true,
    },
    {
      field: 'Category',
      live: categoryName(live.categoryId),
      proposed: categoryName(snippet.categoryId),
    },
    {
      field: 'Snippet',
      live: live.script,
      proposed: snippet.script,
      code: true,
    },
  ]
  return {
    changes: compared.filter((change) => change.live !== change.proposed),
    unchanged: compared
      .filter((change) => change.live === change.proposed)
      .map((change) => change.field.toLowerCase()),
  }
}
