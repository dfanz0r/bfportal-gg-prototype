import { inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seed } from '../../../seed/seed'

import { db, sql } from '../db'
import { experiences } from '../db/schema'
import { getLibrary } from './library'

const NOW = new Date('2026-10-13T12:00:00Z')
const titles = (library: Awaited<ReturnType<typeof getLibrary>>) =>
  library.items.map((item) => item.title)
const all = { page: 20 }

describe('library', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('shows only what is published, not deleted and still loads', async () => {
    const library = await getLibrary('bf6', all, NOW)

    // 34 real ones and 8 made-up ones that are published; one of those no
    // longer loads.
    expect(library.total).toBe(34 + 7)
    for (const hidden of [
      'Hangar Duel', // a draft
      'Bridge Parkour Trials', // pending
      'Night Convoy', // changes requested
      'Free XP 24/7', // removed
      'Old test mode', // deleted
      'Rooftop Gun Game', // no longer on Portal
      'Rush Classic: Arica Harbor', // the other game
    ]) {
      expect(titles(library)).not.toContain(hidden)
    }
    expect(library.games).toEqual([
      { id: 'bf6', name: 'Battlefield 6', path: '/library', count: 41 },
      {
        id: 'bf2042',
        name: 'Battlefield 2042',
        path: '/library/bf2042',
        count: 7,
      },
    ])
  })

  it('brings back what no longer loads when asked, and never the rest', async () => {
    const library = await getLibrary('bf6', { ...all, unavailable: true }, NOW)

    expect(library.total).toBe(42)
    const rooftop = library.items.find(
      (item) => item.title === 'Rooftop Gun Game',
    )
    expect(rooftop?.unavailable).toBe(true)
    expect(titles(library)).not.toContain('Bridge Parkour Trials')
    expect(titles(library)).not.toContain('Old test mode')
  })

  it('pages by growing: page two holds the first two pages', async () => {
    const first = await getLibrary('bf6', {}, NOW)
    const second = await getLibrary('bf6', { page: 2 }, NOW)

    expect(first.items).toHaveLength(12)
    expect(second.items).toHaveLength(24)
    expect(titles(second).slice(0, 12)).toEqual(titles(first))
    expect(second.total).toBe(first.total)
  })

  it("filters 2042 by era, from Portal's tag or from a map", async () => {
    const bc2 = await getLibrary('bf2042', { tag: ['bc2'] }, NOW)
    // Tagged BC2 by Portal, and one with Arica Harbor in its rotation.
    expect(titles(bc2).sort()).toEqual([
      'Gun Master 2042',
      'Rush Classic: Arica Harbor',
    ])

    // Either era will do within the group; the other group must also hold.
    const either = await getLibrary('bf2042', { tag: ['bc2', 'bf3'] }, NOW)
    expect(either.total).toBe(3)
    const both = await getLibrary(
      'bf2042',
      { tag: ['bc2', 'bf3', 'rush'] },
      NOW,
    )
    expect(titles(both)).toEqual(['Rush Classic: Arica Harbor'])
  })

  it('finds a tag by its old name or an old spelling', async () => {
    const byName = await getLibrary('bf2042', { tag: ['no vehicles'] }, NOW)
    const byAlias = await getLibrary('bf2042', { tag: ['bfbc2'] }, NOW)

    expect(byName.search.tag).toEqual(['no-vehicles'])
    expect(byAlias.search.tag).toEqual(['bc2'])
    expect(byAlias.total).toBe(2)
  })

  it('ignores a filter the game does not have', async () => {
    const library = await getLibrary(
      'bf2042',
      { tag: ['parkour'], built: ['script'], free: true, category: 'nope' },
      NOW,
    )

    expect(library.total).toBe(7)
    expect(library.search).toMatchObject({
      tag: undefined,
      built: undefined,
      free: undefined,
      category: undefined,
    })
  })

  it('filters by what it is built with, templates and the free version', async () => {
    const scripted = await getLibrary(
      'bf6',
      { ...all, built: ['script', 'spatial'] },
      NOW,
    )
    expect(titles(scripted)).toContain('Capture the Flag: Siege of Cairo')
    expect(titles(scripted)).not.toContain('Gun Master 2.0')

    const templates = await getLibrary('bf6', { templates: true }, NOW)
    expect(titles(templates).sort()).toEqual([
      'Capture the Flag: Siege of Cairo',
      'Movement Lab',
    ])

    const free = await getLibrary('bf6', { ...all, free: true }, NOW)
    expect(titles(free)).toContain('Air Vehicle Sandbox')
    expect(titles(free)).not.toContain('Capture the Flag: Siege of Cairo')
  })

  it('finds an experience by anyone credited on it', async () => {
    // Gala accepted a credit on it; Coupe is a name with no account.
    for (const q of ['gala', 'Coupe']) {
      const found = titles(await getLibrary('bf6', { ...all, q }, NOW))
      expect(found).toContain('Capture the Flag: Siege of Cairo')
    }
    // north_sector was invited and has not accepted, so is not credited.
    expect(
      titles(await getLibrary('bf6', { ...all, q: 'north_sector' }, NOW)),
    ).not.toContain('Capture the Flag: Siege of Cairo')
  })

  it('searches by title, by code and by creator', async () => {
    expect(titles(await getLibrary('bf6', { q: 'gun master' }, NOW))).toEqual([
      'Gun Master 2.0',
    ])
    expect(titles(await getLibrary('bf6', { q: '1264G' }, NOW))).toEqual([
      'Air Vehicle Sandbox',
    ])
    const byCreator = await getLibrary('bf6', { ...all, q: 'matavatar' }, NOW)
    expect(titles(byCreator).sort()).toEqual([
      'Capture the Flag: Siege of Cairo',
      'Gun Master 2.0',
      'Jump School',
    ])
    // A percent sign is text to look for, not "anything".
    expect((await getLibrary('bf6', { q: '%' }, NOW)).total).toBe(
      (await getLibrary('bf6', { q: '1000%' }, NOW)).total,
    )
  })

  it('sorts by likes, and by newest', async () => {
    const liked = await getLibrary('bf2042', { sort: 'likes' }, NOW)
    expect(liked.items.map((item) => item.likes)).toEqual(
      [...liked.items.map((item) => item.likes)].sort((a, b) => b - a),
    )
    expect(liked.items[0].title).toBe('Rush Classic: Arica Harbor')

    const newest = titles(
      await getLibrary('bf6', { ...all, sort: 'newest' }, NOW),
    )
    // Published 3, 12 and 60 days before.
    const position = (title: string) => newest.indexOf(title)
    expect(position('Friday Night Conquest')).toBeLessThan(
      position('Gun Master 2.0'),
    )
    expect(position('Gun Master 2.0')).toBeLessThan(position('Jump School'))
  })

  it('keeps a template listed when its code goes, if its files can be taken', async () => {
    const gone = { portalState: 'missing' as const }
    try {
      // One has a shared file, one has neither a file nor a link to any.
      await db
        .update(experiences)
        .set(gone)
        .where(
          inArray(experiences.slug, [
            'capture-the-flag-siege-of-cairo',
            'gun-master-2-0',
          ]),
        )
      const library = await getLibrary('bf6', all, NOW)

      const template = library.items.find(
        (item) => item.slug === 'capture-the-flag-siege-of-cairo',
      )
      expect(template).toMatchObject({ unavailable: true, isTemplate: true })
      expect(titles(library)).not.toContain('Gun Master 2.0')
    } finally {
      await seed(db, NOW)
    }
  })

  it('gives a card what it shows', async () => {
    const library = await getLibrary('bf6', { q: 'capture the flag' }, NOW)

    expect(library.items[0]).toMatchObject({
      slug: 'capture-the-flag-siege-of-cairo',
      category: 'Multiplayer',
      maxPlayers: 32,
      types: ['script', 'blocks', 'spatial'],
      isTemplate: true,
      code: '12qx8',
      likes: 44,
      featured: true,
      requiresFullGame: true,
      owner: { name: 'Matavatar' },
      tags: [
        { name: 'Competitive', slug: 'competitive' },
        { name: 'Capture the Flag', slug: 'capture-the-flag' },
      ],
    })
    expect(library.items[0].excerpt).toMatch(/^Get to the opposing flag/)
  })

  it("offers the game's own filters", async () => {
    const bf6 = await getLibrary('bf6', {}, NOW)
    const bf2042 = await getLibrary('bf2042', {}, NOW)

    expect(bf6.tagGroups.map((group) => group.name)).toEqual([
      'Rules',
      'Style',
      'Topic',
    ])
    expect(bf2042.tagGroups.map((group) => [group.name, group.own])).toEqual([
      ['Era', true],
      ['Rules', false],
      ['Style', true],
      ['Topic', false],
    ])
    expect(bf2042.categories.map((category) => category.name)).toContain(
      'Templates',
    )
    expect(bf6.categories.map((category) => category.name)).not.toContain(
      'Templates',
    )
    expect(bf6.stats).toMatchObject({ experiences: 41 })
  })
})
