import { and, eq, ne } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { experiences, revisions } from '../db/schema'
import { getExperience } from './experience'
import { deleteOwnExperience, removeExperience } from './experience-removal'
import { listOwnSubmissions } from './own-submissions'

const NOW = new Date('2026-10-17T12:00:00Z')
const moderator: Actor = { id: 'seed-kestrel', role: 'moderator' }
const admin: Actor = { id: 'seed-gala', role: 'admin' }

/** A live experience not yet used by a test here, and its owner. */
async function live(skip: string[] = []) {
  const rows = await db
    .select({
      id: experiences.id,
      slug: experiences.slug,
      ownerId: experiences.ownerId,
    })
    .from(experiences)
    .where(
      and(
        eq(experiences.status, 'published'),
        ne(experiences.ownerId, moderator.id),
        ne(experiences.ownerId, admin.id),
      ),
    )
    .orderBy(experiences.id)
  const row = rows.find((item) => !skip.includes(item.slug))
  if (!row) throw new Error('expected a live experience')
  return { ...row, owner: { id: row.ownerId, role: 'user' as const } }
}

describe('ending an experience', () => {
  const used: string[] = []

  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('lets only its owner delete it, and then it is gone for everyone', async () => {
    const { id, slug, owner } = await live(used)
    used.push(slug)
    await db.insert(revisions).values({
      experienceId: id,
      kind: 'edit',
      payload: { isTemplate: true },
      submittedBy: owner.id,
    })

    expect(await deleteOwnExperience(null, slug, NOW)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    // A moderator removes instead; someone else cannot know it is there.
    for (const actor of [
      moderator,
      { id: 'seed-recruit-05', role: 'user' as const },
    ]) {
      expect(await deleteOwnExperience(actor, slug, NOW)).toEqual({
        ok: false,
        reason: 'not-found',
      })
    }

    expect(await deleteOwnExperience(owner, slug, NOW)).toEqual({ ok: true })
    expect(await getExperience(slug, NOW, owner)).toBeNull()
    expect(await getExperience(slug, NOW, moderator)).toBeNull()
    const listed = await listOwnSubmissions(owner)
    expect(
      listed.ok && listed.items.some((item) => item.href.endsWith(slug)),
    ).toBe(false)
    // Nothing waits on it in the queue.
    expect(
      await db.select().from(revisions).where(eq(revisions.experienceId, id)),
    ).toEqual([])
    // Once.
    expect((await deleteOwnExperience(owner, slug, NOW)).ok).toBe(false)
  })

  it('lets only a moderator or an admin remove it, with a note its owner sees', async () => {
    const { slug, owner } = await live(used)
    used.push(slug)

    expect(await removeExperience(null, slug, 'Spam.', NOW)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    expect(await removeExperience(owner, slug, 'Spam.', NOW)).toEqual({
      ok: false,
      reason: 'forbidden',
    })
    expect(await removeExperience(moderator, slug, '  ', NOW)).toMatchObject({
      ok: false,
      errors: { note: expect.stringContaining('note') },
    })

    expect(
      await removeExperience(
        moderator,
        slug,
        'An advert, not an experience.',
        NOW,
      ),
    ).toEqual({ ok: true })
    // Gone from the public; its owner sees that it was removed, and why.
    expect(await getExperience(slug, NOW)).toBeNull()
    expect(await getExperience(slug, NOW, owner)).toMatchObject({
      status: 'removed',
      reviewNote: 'An advert, not an experience.',
    })
    const listed = await listOwnSubmissions(owner)
    expect(
      listed.ok && listed.items.find((item) => item.href.endsWith(slug)),
    ).toMatchObject({ listing: 'Removed', editHref: null })
    // Removed once; it cannot be removed again.
    expect((await removeExperience(admin, slug, 'Again.', NOW)).ok).toBe(false)
  })

  it('has no draft to remove, since a draft was sent to nobody', async () => {
    const [draft] = await db
      .select({ slug: experiences.slug })
      .from(experiences)
      .where(eq(experiences.status, 'draft'))
      .limit(1)
    expect(await removeExperience(admin, draft.slug, 'Spam.', NOW)).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })
})
