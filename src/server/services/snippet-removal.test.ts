import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { revisions, snippets } from '../db/schema'
import { listQueue } from './moderation'
import { listOwnSubmissions } from './own-submissions'
import { deleteOwnSnippet, removeSnippet } from './snippet-removal'
import { getSnippetEditPage, submitSnippet } from './snippet-submissions'
import { getSnippet, listSnippets } from './snippets'

const NOW = new Date('2026-10-18T12:00:00Z')
const moderator: Actor = { id: 'seed-kestrel', role: 'moderator' }
const admin: Actor = { id: 'seed-gala', role: 'admin' }
const owner: Actor = { id: 'seed-recruit-33', role: 'user' }

/** A snippet of the owner's, sent and approved, live under `title`. */
async function liveSnippet(title: string) {
  const sent = await submitSnippet(
    owner,
    {
      title,
      description: 'For a test.',
      script: 'let a = 1\n',
      category: 'rules',
    },
    { now: NOW },
  )
  if (!sent.ok) throw new Error('expected the snippet to be sent')
  const [row] = await db
    .update(snippets)
    .set({ status: 'published', firstPublishedAt: NOW })
    .where(eq(snippets.slug, sent.slug))
    .returning({ id: snippets.id })
  return { id: row.id, slug: sent.slug }
}

describe('ending a snippet', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('lets only its owner delete it, and then it is gone for everyone', async () => {
    const { id, slug } = await liveSnippet('Deleted snippet')
    // An edit waiting on it.
    await submitSnippet(
      owner,
      {
        editing: slug,
        title: 'Deleted snippet, changed',
        script: 'let a = 2\n',
        category: 'rules',
      },
      { now: NOW },
    )

    expect(await deleteOwnSnippet(null, slug, NOW)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    // A moderator removes instead; someone else cannot know it is there.
    for (const actor of [moderator, { id: 'seed-recruit-05', role: 'user' }]) {
      expect(await deleteOwnSnippet(actor as Actor, slug, NOW)).toEqual({
        ok: false,
        reason: 'not-found',
      })
    }

    expect(await deleteOwnSnippet(owner, slug, NOW)).toEqual({ ok: true })
    expect(await getSnippet(slug, NOW, owner)).toBeNull()
    expect(await getSnippet(slug, NOW, moderator)).toBeNull()
    expect(
      (await listSnippets({ limit: 100 })).items.some(
        (item) => item.slug === slug,
      ),
    ).toBe(false)
    const listed = await listOwnSubmissions(owner)
    expect(
      listed.ok && listed.items.some((item) => item.href.endsWith(slug)),
    ).toBe(false)
    // Nothing waits on it in the queue.
    expect(
      await db.select().from(revisions).where(eq(revisions.snippetId, id)),
    ).toEqual([])
    const queue = await listQueue(moderator)
    expect(
      queue.ok && queue.edits.some((item) => item.kind === 'snippet'),
    ).toBe(false)
    // Once.
    expect((await deleteOwnSnippet(owner, slug, NOW)).ok).toBe(false)
  })

  it('lets only a moderator or an admin remove it, with a note its owner sees', async () => {
    const { slug } = await liveSnippet('Removed snippet')

    expect(await removeSnippet(null, slug, 'Spam.', NOW)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    expect(await removeSnippet(owner, slug, 'Spam.', NOW)).toEqual({
      ok: false,
      reason: 'forbidden',
    })
    expect(await removeSnippet(moderator, slug, '  ', NOW)).toMatchObject({
      ok: false,
      errors: { note: expect.stringContaining('note') },
    })

    expect(
      await removeSnippet(moderator, slug, 'Not a snippet: an advert.', NOW),
    ).toEqual({ ok: true })
    // Gone from the public; its owner sees that it was removed, and why, and
    // cannot send it again.
    expect(await getSnippet(slug, NOW)).toBeNull()
    expect(await getSnippet(slug, NOW, owner)).toMatchObject({
      status: 'removed',
      reviewNote: 'Not a snippet: an advert.',
      viewer: { canEdit: false },
    })
    expect((await getSnippetEditPage(owner, slug, {})).state).toBe('not-found')
    const listed = await listOwnSubmissions(owner)
    expect(
      listed.ok && listed.items.find((item) => item.href.endsWith(slug)),
    ).toMatchObject({ listing: 'Removed', editHref: null })
    // Removed once; it cannot be removed again.
    expect((await removeSnippet(admin, slug, 'Again.', NOW)).ok).toBe(false)
  })

  it('removes one still waiting for review, which then leaves the queue', async () => {
    const sent = await submitSnippet(
      owner,
      {
        title: 'Waiting snippet',
        script: 'let b = 1\n',
        category: 'rules',
      },
      { now: NOW },
    )
    if (!sent.ok) throw new Error('expected the snippet to be sent')
    expect(await removeSnippet(admin, sent.slug, 'Spam.', NOW)).toEqual({
      ok: true,
    })
    const queue = await listQueue(moderator)
    expect(
      queue.ok && queue.snippets.some((item) => item.slug === sent.slug),
    ).toBe(false)
  })
})
