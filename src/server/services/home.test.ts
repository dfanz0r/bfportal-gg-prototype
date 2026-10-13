import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { db, sql } from '../db'
import { getHome } from './home'

const NOW = new Date('2026-10-13T12:00:00Z')

describe('home', () => {
  let home: Awaited<ReturnType<typeof getHome>>

  beforeAll(async () => {
    await seed(db, NOW)
    home = await getHome(NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('shows the banner that is running now', () => {
    expect(home.banner).toMatchObject({ label: 'Live now' })
  })

  it('counts what anyone can see', () => {
    expect(home.stats).toMatchObject({ experiences: 48, scripts: 2 })
    expect(home.games).toEqual([
      { id: 'bf6', name: 'Battlefield 6', count: 41 },
      { id: 'bf2042', name: 'Battlefield 2042', count: 7 },
    ])
  })

  it("leads with the first game's trending experiences", () => {
    expect(home.trending).toHaveLength(8)
    expect(home.trending.every((card) => card.game === 'bf6')).toBe(true)
    expect(home.trending.some((card) => card.unavailable)).toBe(false)
  })

  it('lists the newest published updates, on experiences and scripts', () => {
    expect(
      home.updates.map((update) => [update.project.kind, update.title]),
    ).toEqual([
      ['experience', 'Version 1.3: sudden death and a third map'],
      ['script', 'Boss waves are now configurable'],
      ['experience', 'Looking for testers: four-player hard mode'],
    ])
  })

  it('lists open playtests only: not pending, not closed', () => {
    expect(home.playtests.map((playtest) => playtest.name)).toEqual([
      'Zombies: Last Light',
      'Capture the Flag: Siege of Cairo',
    ])
  })

  it('lists scripts by likes', () => {
    expect(home.scripts.map((script) => script.title)).toEqual([
      'Round-based economy',
      'AI wave spawner',
    ])
  })

  it('lists events that are under way or still to come, soonest first', () => {
    expect(home.events.map((event) => [event.title, event.live])).toEqual([
      ['New experiences playtest', true],
      ['Friday Night Battlefield', false],
      ['Hardcore Rush Cup', false],
    ])
    expect(home.events[0].interested).toBe(38)
  })
})
