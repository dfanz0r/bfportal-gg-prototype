import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { experienceLikes } from '../db/schema'
import { setLike } from './likes'

const NOW = new Date('2026-10-13T12:00:00Z')
// A seed account that has not liked the experience below.
const visitor: Actor = { id: 'seed-matavatar', role: 'user' }
const SLUG = 'friday-night-conquest'

describe('liking', () => {
  beforeAll(async () => {
    await seed(db, NOW)
    await db
      .delete(experienceLikes)
      .where(eq(experienceLikes.userId, visitor.id))
  })

  afterAll(async () => {
    await sql.end()
  })

  it('refuses a visitor who is not signed in', async () => {
    expect(await setLike(null, SLUG, true)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
  })

  it('likes once however often it is asked, and unlikes', async () => {
    const before = await setLike(visitor, SLUG, false)
    if (!before.ok) throw new Error('expected the unlike to succeed')

    const first = await setLike(visitor, SLUG, true)
    const again = await setLike(visitor, SLUG, true)
    expect(first).toEqual({ ok: true, liked: true, likes: before.likes + 1 })
    expect(again).toEqual(first)

    expect(await setLike(visitor, SLUG, false)).toEqual({
      ok: true,
      liked: false,
      likes: before.likes,
    })
  })

  it('has nothing to like that the public cannot see', async () => {
    for (const hidden of [
      'hangar-duel', // a draft
      'bridge-parkour-trials', // pending
      'night-convoy', // changes requested
      'free-xp-24-7', // removed
      'old-test-mode', // deleted
      'no-such-experience',
    ]) {
      expect(await setLike(visitor, hidden, true)).toEqual({
        ok: false,
        reason: 'not-found',
      })
    }
  })
})
