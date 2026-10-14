import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { experiences } from '../db/schema'
import type { Lookup } from '../integrations/gametools'
import { getExperience } from './experience'
import { getLibrary } from './library'
import { decideSubmission, getSubmissionReview, listQueue } from './moderation'
import { submitExperience } from './submissions'

const NOW = new Date('2026-10-13T12:00:00Z')
const someone: Actor = { id: 'seed-vantage', role: 'user' }
const moderator: Actor = { id: 'seed-kestrel', role: 'moderator' }
const admin: Actor = { id: 'seed-gala', role: 'admin' }
const unavailable = {
  lookup: async (): Promise<Lookup> => ({ status: 'unavailable' }),
}

async function idOf(slug: string) {
  const [row] = await db
    .select({ id: experiences.id })
    .from(experiences)
    .where(eq(experiences.slug, slug))
  return row.id
}

/** A new pending submission, returning its id. */
async function submit(title: string, changes: Record<string, unknown> = {}) {
  const result = await submitExperience(
    someone,
    {
      game: 'bf6',
      code: '1abc2',
      category: 'multiplayer',
      title,
      description:
        'A description long enough to say what the experience is and how it plays.',
      maxPlayers: '32',
      ...changes,
    },
    { ...unavailable, now: NOW },
  )
  if (!result.ok) throw new Error(`could not submit: ${JSON.stringify(result)}`)
  return idOf(result.slug)
}

describe('moderation', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('is closed to everyone but moderators and admins', async () => {
    const id = await idOf('bridge-parkour-trials')
    for (const [actor, reason] of [
      [null, 'signed-out'],
      [someone, 'forbidden'],
    ] as const) {
      const refused = { ok: false, reason }
      expect(await listQueue(actor)).toEqual(refused)
      expect(await getSubmissionReview(actor, id, unavailable)).toEqual(refused)
      expect(await decideSubmission(actor, id, { approve: true })).toEqual(
        refused,
      )
    }
    // Still waiting: nobody above could decide it.
    expect(await getExperience('bridge-parkour-trials', NOW)).toBeNull()

    for (const actor of [moderator, admin]) {
      expect(await listQueue(actor)).toMatchObject({ ok: true })
    }
  })

  it('lists what is waiting, the longest wait first', async () => {
    await submit('Newer submission')
    const queue = await listQueue(moderator)
    if (!queue.ok) throw new Error('expected the queue')

    const titles = queue.items.map((item) => item.title)
    expect(titles).toContain('Bridge Parkour Trials')
    expect(titles).not.toContain('Free XP 24/7') // removed
    expect(titles).not.toContain('Night Convoy') // sent back for changes
    expect(titles).not.toContain('Hangar Duel') // a draft, never sent in
    expect(titles).not.toContain('Gun Master 2.0') // published
    const waits = queue.items.map((item) => item.submittedAt.getTime())
    expect(waits).toEqual([...waits].sort((a, b) => a - b))
    // Few enough to show them all; the count is of everything waiting.
    expect(queue.total).toBe(queue.items.length)
  })

  it('tells a moderator what to look at before deciding', async () => {
    const first = await submit('First with this code', { code: '1dup9' })
    const second = await submit('Second with this code', {
      code: '1dup9',
      description:
        '![x](https://tracker.example/p.gif) ![y](https://i.imgur.com/a.png)',
      coverImgUrl: 'https://covers.example/c.png',
      images: 'https://gallery.example/g.png\nhttps://i.imgur.com/b.png',
    })

    // The queue says so before either is opened.
    const queue = await listQueue(moderator)
    if (!queue.ok) throw new Error('expected the queue')
    const sharesCode = (title: string) =>
      queue.items.find((item) => item.title === title)?.sameCode
    expect(sharesCode('First with this code')).toBe(true)
    expect(sharesCode('Second with this code')).toBe(true)
    expect(sharesCode('Bridge Parkour Trials')).toBe(false)

    const review = await getSubmissionReview(moderator, second, {
      lookup: async () => ({
        status: 'found',
        experience: {
          playgroundId: null,
          code: '1dup9',
          title: 'What Portal calls it',
          description: '',
          thumbnailUrl: null,
          published: true,
          rotation: [],
          tags: [],
          xpMode: null,
          requiresFullGame: null,
        },
      }),
    })
    if (!review.ok) throw new Error('expected the review')

    expect(review.checks).toMatchObject({
      portal: 'published',
      portalTitle: 'What Portal calls it',
      // imgur is an everyday host; the others are worth a look, whether the
      // picture is in the description, the cover or the gallery.
      pictureHosts: ['covers.example', 'gallery.example', 'tracker.example'],
      thinDescription: true,
      hasCover: true,
    })
    expect(review.checks.sameCode.map((other) => other.title)).toEqual([
      'First with this code',
    ])
    expect(review.submitter).toMatchObject({ name: 'vantage' })
    expect(review.submitter.published).toBeGreaterThan(0)

    // gametools not answering is said as that, not as the code being gone.
    const quiet = await getSubmissionReview(moderator, first, unavailable)
    expect(quiet.ok && quiet.checks.portal).toBe('unavailable')
  })

  it('publishes on approval, once', async () => {
    const id = await submit('Approve me')

    expect(
      await decideSubmission(moderator, id, { approve: true }, NOW),
    ).toEqual({
      ok: true,
      slug: 'approve-me',
      status: 'published',
    })
    const page = await getExperience('approve-me', NOW)
    expect(page).toMatchObject({ status: 'published', publishedAt: NOW })
    const library = await getLibrary('bf6', { q: 'approve me' }, NOW)
    expect(library.total).toBe(1)

    // Decided already: there is nothing waiting to decide.
    expect(
      await decideSubmission(admin, id, {
        approve: false,
        note: 'changed my mind',
      }),
    ).toEqual({ ok: false, reason: 'not-found' })
    expect(await getSubmissionReview(moderator, id, unavailable)).toEqual({
      ok: false,
      reason: 'not-found',
    })
  })

  it('requests changes only with a note, which its owner then sees', async () => {
    const id = await submit('Turn me down')

    expect(
      await decideSubmission(moderator, id, { approve: false, note: ' ' }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid',
      errors: { note: expect.any(String) },
    })
    expect(
      await decideSubmission(moderator, id, {
        approve: false,
        note: 'The code does not load.',
      }),
    ).toMatchObject({ ok: true, status: 'changes_requested' })

    expect(await getExperience('turn-me-down', NOW)).toBeNull()
    expect(await getExperience('turn-me-down', NOW, someone)).toMatchObject({
      status: 'changes_requested',
      reviewNote: 'The code does not load.',
    })
  })
})
