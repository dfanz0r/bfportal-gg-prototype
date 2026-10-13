import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { db, sql } from '../db'
import { projectFiles } from '../db/schema'
import { getExperience, getProjectFile } from './experience'

const NOW = new Date('2026-10-13T12:00:00Z')

describe('experience', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('is not there unless it is published and not deleted', async () => {
    expect(await getExperience('bridge-parkour-trials', NOW)).toBeNull() // pending
    expect(await getExperience('free-xp-24-7', NOW)).toBeNull() // rejected
    expect(await getExperience('old-test-mode', NOW)).toBeNull() // deleted
    expect(await getExperience('no-such-thing', NOW)).toBeNull()
    // Gone from Portal, but its page stays.
    const gone = await getExperience('rooftop-gun-game', NOW)
    expect(gone).toMatchObject({ unavailable: true, portalState: 'missing' })
  })

  it('gives the page what it shows', async () => {
    const page = await getExperience('capture-the-flag-siege-of-cairo', NOW)

    expect(page).toMatchObject({
      game: 'bf6',
      title: 'Capture the Flag: Siege of Cairo',
      category: { name: 'Multiplayer', slug: 'multiplayer' },
      code: '12qx8',
      copyAllowed: true,
      isTemplate: true,
      requiresFullGame: true,
      likes: 44,
      owner: { name: 'Matavatar' },
      sdk: { version: '1.4.3.0', season: 'Season 4', releasesBehind: 0 },
    })
    // The cover and three gallery pictures.
    expect(page?.images).toHaveLength(4)
    expect(page?.rotation.map((entry) => entry.name)).toEqual([
      'Siege of Cairo',
      'Mirak Valley',
      'Empire State',
    ])
    expect(page?.rotation[0]).toMatchObject({ mode: 'Custom', players: 32 })
    expect(page?.files.map((file) => file.filename)).toEqual(['Script.ts'])
    expect(page?.more.map((card) => card.title).sort()).toEqual([
      'Gun Master 2.0',
      'Jump School',
      'Rush Classic: Arica Harbor',
    ])
  })

  it('credits names and accounts that accepted, not a pending invitation', async () => {
    const page = await getExperience('capture-the-flag-siege-of-cairo', NOW)

    // north_sector was invited and has not accepted.
    expect(page?.creators.map((creator) => creator.name)).toEqual([
      'Gala',
      'kestrel',
      'Coupe',
    ])
  })

  it('shows published updates only, newest first', async () => {
    const page = await getExperience('capture-the-flag-siege-of-cairo', NOW)
    expect(page?.updates.map((update) => update.title)).toEqual([
      'Version 1.3: sudden death and a third map',
      'Version 1.2: balance pass',
    ])
    // Its one update is still waiting for a moderator.
    const waiting = await getExperience('jump-school', NOW)
    expect(waiting?.updates).toEqual([])
  })

  it('shows a playtest only while it is open', async () => {
    const open = await getExperience('capture-the-flag-siege-of-cairo', NOW)
    expect(open?.playtest).toMatchObject({ regions: ['eu'] })
    // Closed four days ago.
    const closed = await getExperience('gun-master-2-0', NOW)
    expect(closed?.playtest).toBeNull()
  })

  it('says how far behind the latest SDK release it is', async () => {
    const page = await getExperience('zombies-last-light', NOW)
    expect(page?.sdk).toEqual({
      version: '1.3.2.0',
      season: 'Season 3',
      releasesBehind: 4,
      latest: '1.4.3.0',
    })
    // A real one, whose creators have not said.
    expect((await getExperience('air-vehicle-sandbox', NOW))?.sdk).toBeNull()
  })

  it('hands out a file only for a published template', async () => {
    const [file] = await db
      .select({ id: projectFiles.id })
      .from(projectFiles)
      .where(eq(projectFiles.filename, 'Script.ts'))

    const found = await getProjectFile(file.id)
    expect(found?.filename).toBe('Script.ts')
    expect(found?.body).toContain('RETURN_AFTER_SECONDS')
    expect(await getProjectFile(999999)).toBeNull()
  })
})
