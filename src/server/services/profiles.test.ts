import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { db, sql } from '../db'
import { updates, user } from '../db/schema'
import { getProfile } from './profiles'

const NOW = new Date('2026-10-13T12:00:00Z')

async function discordIdOf(name: string) {
  const [row] = await db
    .select({ discordId: user.discordId })
    .from(user)
    .where(eq(user.name, name))
  return row.discordId
}

describe('profile', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('shows what someone owns and what they are credited on', async () => {
    const gala = await getProfile(await discordIdOf('Gala'), 'experiences')

    // Gala owns three published ones, one of them a template with no code,
    // and accepted a credit on Matavatar's. Her pending one is not counted.
    expect(gala?.cards.map((card) => card.title).sort()).toEqual([
      'Capture the Flag: Siege of Cairo',
      'Gun Master 2042',
      'Movement Lab',
      'Wingsuit Race: Breakaway',
    ])
    expect(gala?.counts).toMatchObject({ experiences: 4, updates: 1 })
  })

  it('does not list an invitation that was never accepted', async () => {
    const invited = await getProfile(
      await discordIdOf('north_sector'),
      'experiences',
    )
    expect(invited?.cards.map((card) => card.title)).not.toContain(
      'Capture the Flag: Siege of Cairo',
    )
  })

  it('lists snippets and likes on their own tabs', async () => {
    const id = await discordIdOf('Matavatar')
    const shared = await getProfile(id, 'snippets')
    expect(shared?.snippets.map((snippet) => snippet.title)).toEqual([
      'AI wave spawner',
    ])
    expect(shared?.cards).toEqual([])

    const liked = await getProfile(id, 'liked')
    // The first page of them.
    expect(liked?.cards.length).toBe(Math.min(liked?.counts.liked ?? 0, 12))
    expect(liked?.counts.liked).toBeGreaterThan(0)
  })

  it('counts only the update posts a visitor could see', async () => {
    const id = await discordIdOf('Matavatar')
    // Three published, and one still waiting for a moderator.
    expect((await getProfile(id, 'experiences'))?.counts.updates).toBe(3)

    await db
      .update(updates)
      .set({ deletedAt: NOW })
      .where(eq(updates.title, 'Boss waves are now configurable'))
    expect((await getProfile(id, 'experiences'))?.counts.updates).toBe(2)
  })

  it('pages a list by growing it', async () => {
    const id = await discordIdOf('Recruit 01')
    const first = await getProfile(id, 'liked', 1)
    const second = await getProfile(id, 'liked', 2)

    expect(first?.counts.liked).toBeGreaterThan(12)
    expect(first?.cards).toHaveLength(12)
    expect(second?.cards).toHaveLength(Math.min(24, second?.counts.liked ?? 0))
    expect(second?.cards.slice(0, 12)).toEqual(first?.cards)
  })

  it('keeps a hidden name off the profile, and has nothing for nobody', async () => {
    const id = await discordIdOf('vantage')
    await db
      .update(user)
      .set({ hideUsername: true })
      .where(eq(user.discordId, id))

    expect(await getProfile(id, 'experiences')).toMatchObject({
      name: null,
      image: null,
    })
    // An id no test creates: other files leave their own accounts behind.
    expect(await getProfile('404404404404', 'experiences')).toBeNull()
  })
})
