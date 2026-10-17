import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { db, sql } from '../db'
import { experienceLikes, experiences, projectFiles } from '../db/schema'
import { getExperience, getProjectFile } from './experience'
import { reportExperience } from './reports'

const NOW = new Date('2026-10-13T12:00:00Z')

describe('experience', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('is not there unless it is published and not deleted', async () => {
    expect(await getExperience('hangar-duel', NOW)).toBeNull() // a draft
    expect(await getExperience('bridge-parkour-trials', NOW)).toBeNull() // pending
    expect(await getExperience('night-convoy', NOW)).toBeNull() // changes requested
    expect(await getExperience('free-xp-24-7', NOW)).toBeNull() // removed
    expect(await getExperience('old-test-mode', NOW)).toBeNull() // deleted
    expect(await getExperience('no-such-thing', NOW)).toBeNull()
    // Gone from Portal, but its page stays.
    const gone = await getExperience('rooftop-gun-game', NOW)
    expect(gone).toMatchObject({ unavailable: true, portalState: 'missing' })
  })

  it('lets its owner and the moderators see it before it is published', async () => {
    const pending = 'bridge-parkour-trials'
    const owner = { id: 'seed-gala', role: 'user' } as const
    const stranger = { id: 'seed-vantage', role: 'user' } as const
    const moderator = { id: 'seed-kestrel', role: 'moderator' } as const

    expect(await getExperience(pending, NOW, stranger)).toBeNull()
    expect(await getExperience(pending, NOW, owner)).toMatchObject({
      status: 'pending',
      viewer: { isOwner: true, isStaff: false },
    })
    expect(await getExperience(pending, NOW, moderator)).toMatchObject({
      viewer: { isOwner: false, isStaff: true },
    })
    // Its owner is told why it was removed; nobody else can open it.
    const removed = await getExperience('free-xp-24-7', NOW, {
      id: 'seed-north-sector',
      role: 'user',
    })
    expect(removed).toMatchObject({ status: 'removed' })
    expect(removed?.reviewNote).toMatch(/duplicate/)
    // The same for one sent back for changes, and for a draft nobody has
    // reviewed.
    const gala = { id: 'seed-gala', role: 'user' } as const
    expect(await getExperience('night-convoy', NOW, gala)).toMatchObject({
      status: 'changes_requested',
      reviewNote: expect.stringMatching(/Two changes/),
    })
    expect(await getExperience('hangar-duel', NOW, gala)).toMatchObject({
      status: 'draft',
      reviewNote: null,
    })
    expect(await getExperience('hangar-duel', NOW, stranger)).toBeNull()
    // Deleted by its owner: gone for everyone.
    expect(await getExperience('old-test-mode', NOW, moderator)).toBeNull()
  })

  it('knows whether whoever is looking has liked it', async () => {
    const slug = 'capture-the-flag-siege-of-cairo'
    const anonymous = await getExperience(slug, NOW)
    expect(anonymous?.viewer).toEqual({
      signedIn: false,
      liked: false,
      reported: [],
      isOwner: false,
      isStaff: false,
      templateRequest: null,
      canOfferTemplate: false,
    })
    const [liker] = await db
      .select({ userId: experienceLikes.userId })
      .from(experienceLikes)
      .innerJoin(experiences, eq(experiences.id, experienceLikes.experienceId))
      .where(eq(experiences.slug, slug))
      .limit(1)
    const theirs = await getExperience(slug, NOW, {
      id: liker.userId,
      role: 'user',
    })
    expect(theirs?.viewer.liked).toBe(true)
  })

  it('knows what whoever is looking has already reported', async () => {
    const slug = 'capture-the-flag-siege-of-cairo'
    const reporter = { id: 'seed-vantage', role: 'user' } as const
    await reportExperience(reporter, slug, 'bugged')

    const theirs = await getExperience(slug, NOW, reporter)
    expect(theirs?.viewer.reported).toEqual(['bugged'])
    // Someone else's report is not theirs.
    const other = await getExperience(slug, NOW, {
      id: 'seed-kestrel',
      role: 'moderator',
    })
    expect(other?.viewer.reported).toEqual([])
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
    expect(page?.gallery).toHaveLength(4)
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

  it('hands out a file for a published template, and before that only to its owner and moderators', async () => {
    const [file] = await db
      .select({
        id: projectFiles.id,
        experienceId: projectFiles.experienceId,
        ownerId: experiences.ownerId,
      })
      .from(projectFiles)
      .innerJoin(experiences, eq(experiences.id, projectFiles.experienceId))
      .where(eq(projectFiles.filename, 'Script.ts'))
    const owner = { id: file.ownerId, role: 'user' as const }
    const someone = { id: 'seed-kestrel', role: 'user' as const }
    const moderator = { id: 'seed-gala', role: 'moderator' as const }

    const found = await getProjectFile(file.id, null)
    expect(found?.filename).toBe('Script.ts')
    expect(found?.body).toContain('RETURN_AFTER_SECONDS')
    expect(await getProjectFile(999999, moderator)).toBeNull()

    // Waiting for a moderator: not for anyone yet.
    await db
      .update(experiences)
      .set({ status: 'pending' })
      .where(eq(experiences.id, file.experienceId ?? 0))
    try {
      expect(await getProjectFile(file.id, null)).toBeNull()
      expect(await getProjectFile(file.id, someone)).toBeNull()
      expect(await getProjectFile(file.id, owner)).not.toBeNull()
      expect(await getProjectFile(file.id, moderator)).not.toBeNull()
    } finally {
      await db
        .update(experiences)
        .set({ status: 'published' })
        .where(eq(experiences.id, file.experienceId ?? 0))
    }
  })
})
