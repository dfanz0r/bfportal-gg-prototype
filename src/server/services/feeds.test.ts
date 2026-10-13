import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { db, sql } from '../db'
import { playtests } from '../db/schema'
import { countEvents, listEvents } from './events'
import { getPlaytest, listPlaytests } from './playtests'
import { getSnippet, listSnippets } from './snippets'
import { listUpdates } from './updates'

const NOW = new Date('2026-10-13T12:00:00Z')

describe('updates, playtests, events and scripts', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('lists published update posts, by kind and by game', async () => {
    const all = await listUpdates({ limit: 50 })
    // Six in the seed; one is still waiting for a moderator.
    expect(all.total).toBe(5)
    expect(all.items[0].title).toBe('Version 1.3: sudden death and a third map')

    const scripts = await listUpdates({ kind: 'script', limit: 50 })
    expect(scripts.items.map((update) => update.project.title)).toEqual([
      'AI wave spawner',
    ])
    expect((await listUpdates({ game: 'bf6', limit: 50 })).total).toBe(4)
    expect((await listUpdates({ game: 'bf2042', limit: 50 })).total).toBe(0)
    expect((await listUpdates({ limit: 2 })).items).toHaveLength(2)
  })

  it('lists playtests that are open, and the ones that have closed', async () => {
    const open = await listPlaytests({ state: 'open', limit: 50 }, NOW)
    expect(open.items.map((playtest) => playtest.name)).toEqual([
      'Zombies: Last Light',
      'Capture the Flag: Siege of Cairo',
    ])
    expect(open.items.every((playtest) => playtest.open)).toBe(true)
    const closed = await listPlaytests({ state: 'closed', limit: 50 }, NOW)
    expect(closed.items).toMatchObject([
      { name: 'Gun Master 2.0', open: false, hasResult: true },
    ])
  })

  it("shows a playtest's page only once it is approved", async () => {
    const rows = await db
      .select({ id: playtests.id, status: playtests.status })
      .from(playtests)
    const pending = rows.find((row) => row.status === 'pending')
    const [open] = (await listPlaytests({ state: 'open', limit: 1 }, NOW)).items

    expect(pending && (await getPlaytest(pending.id, NOW))).toBeNull()
    expect(await getPlaytest(999999, NOW)).toBeNull()
    const page = await getPlaytest(open.id, NOW)
    expect(page).toMatchObject({
      name: 'Zombies: Last Light',
      open: true,
      host: { name: 'BattlefieldDad' },
    })
    expect(page?.briefHtml).toContain('What to try')
    expect(page?.discordUrl).toMatch(/^https:\/\/discord\.com\//)

    const [closedRow] = await db
      .select({ id: playtests.id })
      .from(playtests)
      .where(eq(playtests.code, '1xq89'))
    expect(await getPlaytest(closedRow.id, NOW)).toMatchObject({
      open: false,
      resultTitle: 'Fixed: the knife demotion applied twice',
    })
  })

  it('lists events to come soonest first, and past ones latest first', async () => {
    const upcoming = await listEvents({ when: 'upcoming', limit: 50 }, NOW)
    expect(upcoming.items.map((event) => [event.title, event.live])).toEqual([
      ['New experiences playtest', true],
      ['Friday Night Battlefield', false],
      ['Hardcore Rush Cup', false],
    ])
    expect(await countEvents(NOW)).toEqual({ upcoming: 3, past: 1 })
    const past = await listEvents({ when: 'past', limit: 50 }, NOW)
    expect(past.items.map((event) => event.title)).toEqual([
      'Scripting workshop',
    ])
    expect(past.items[0].interested).toBe(44)
  })

  it('lists scripts, by category, and shows one', async () => {
    const all = await listSnippets({ limit: 50 })
    expect(all.items.map((script) => script.title)).toEqual([
      'Round-based economy',
      'AI wave spawner',
    ])
    expect(
      all.categories.map((category) => [category.name, category.count]),
    ).toEqual([
      ['Rules', 1],
      ['AI', 1],
      ['Interface', 0],
      ['Admin tools', 0],
    ])
    const ai = await listSnippets({ category: 'ai', limit: 50 })
    expect(ai.items.map((script) => script.title)).toEqual(['AI wave spawner'])

    const page = await getSnippet('ai-wave-spawner', NOW)
    expect(page).toMatchObject({
      title: 'AI wave spawner',
      category: 'AI',
      likes: 34,
      sdk: { version: '1.4.3.0', season: 'Season 4' },
      owner: { name: 'Matavatar' },
    })
    expect(page?.lines).toBe(17)
    expect(page?.script).toContain('startNextWave')
    expect(page?.updates.map((update) => update.title)).toEqual([
      'Boss waves are now configurable',
    ])
    expect(await getSnippet('no-such-script', NOW)).toBeNull()
  })
})
