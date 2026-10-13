import { and, count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { experienceReports, experiences } from '../db/schema'
import { reportExperience } from './reports'

const NOW = new Date('2026-10-13T12:00:00Z')
const SLUG = 'gun-master-2-0'
const owner: Actor = { id: 'seed-matavatar', role: 'user' }
const visitor: Actor = { id: 'seed-gala', role: 'user' }

async function reports() {
  const [row] = await db
    // Counting a column, so an experience with no reports counts none.
    .select({
      value: count(experienceReports.userId),
      bugged: experiences.bugged,
    })
    .from(experiences)
    .leftJoin(
      experienceReports,
      eq(experienceReports.experienceId, experiences.id),
    )
    .where(and(eq(experiences.slug, SLUG)))
    .groupBy(experiences.id)
  return row
}

describe('reporting', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('refuses a visitor who is not signed in, and the owner', async () => {
    expect(await reportExperience(null, SLUG, 'bugged')).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    expect(await reportExperience(owner, SLUG, 'bugged')).toEqual({
      ok: false,
      reason: 'forbidden',
    })
  })

  it('counts a report once per person and kind, and sets no flag', async () => {
    const before = await reports()

    expect(await reportExperience(visitor, SLUG, 'bugged')).toEqual({
      ok: true,
    })
    expect(await reportExperience(visitor, SLUG, 'bugged')).toEqual({
      ok: true,
    })
    expect(await reportExperience(visitor, SLUG, 'xp_farm')).toEqual({
      ok: true,
    })

    const after = await reports()
    expect(after.value).toBe(before.value + 2)
    // A moderator decides what a report means.
    expect(after.bugged).toBe(false)
  })

  it('has nothing to report that the public cannot see', async () => {
    expect(
      await reportExperience(visitor, 'bridge-parkour-trials', 'broken'),
    ).toEqual({ ok: false, reason: 'not-found' })
  })
})
