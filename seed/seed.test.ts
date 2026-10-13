import { count, eq, ne, sql as raw } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'

import { db, sql } from '../src/server/db'
import {
  experienceCreators,
  experiences,
  experienceTags,
  tags,
  user,
} from '../src/server/db/schema'
import { seed } from './seed'

const NOW = new Date('2026-10-13T12:00:00Z')

describe('seed', () => {
  afterAll(async () => {
    await sql.end()
  })

  it('fills the database, and again without duplicating or losing a real account', async () => {
    await db.execute(raw`truncate ${user} restart identity cascade`)
    await db.insert(user).values({
      id: 'someone-real',
      name: 'Someone real',
      email: 'real@example.com',
      discordId: '1',
      discordUsername: 'real',
    })

    const first = await seed(db, NOW)
    const second = await seed(db, NOW)

    expect(second).toEqual(first)
    expect(first.experiences).toBe(34 + 19)
    const [real] = await db
      .select({ value: count() })
      .from(user)
      .where(eq(user.id, 'someone-real'))
    expect(real.value).toBe(1)
  })

  it('only gives an experience tags of its own game', async () => {
    const strays = await db
      .select({ slug: experiences.slug, tag: tags.name })
      .from(experienceTags)
      .innerJoin(experiences, eq(experiences.id, experienceTags.experienceId))
      .innerJoin(tags, eq(tags.id, experienceTags.tagId))
      .where(ne(tags.game, experiences.game))

    expect(strays).toEqual([])
  })

  it('tags a 2042 experience with the eras of its maps', async () => {
    const rows = await db
      .select({ tag: tags.name, source: experienceTags.source })
      .from(experienceTags)
      .innerJoin(experiences, eq(experiences.id, experienceTags.experienceId))
      .innerJoin(tags, eq(tags.id, experienceTags.tagId))
      .where(eq(experiences.slug, 'gun-master-2042'))

    // Portal tagged it "Map Faction" only. Its rotation has a map from each
    // game, and those are where the four eras come from.
    const fromMaps = rows.filter((row) => row.source === 'map')
    expect(fromMaps.map((row) => row.tag).sort()).toEqual([
      '1942',
      '2042',
      'BC2',
      'BF3',
    ])
  })

  it('knows which experiences the free version can play', async () => {
    const rows = await db
      .select({
        slug: experiences.slug,
        requiresFullGame: experiences.requiresFullGame,
      })
      .from(experiences)
    const answer = Object.fromEntries(
      rows.map((row) => [row.slug, row.requiresFullGame]),
    )

    // Portal Sandbox is a free map, as EA's site says of this experience.
    expect(answer['air-vehicle-sandbox']).toBe(false)
    // Worked out from its maps: Siege of Cairo needs the paid game.
    expect(answer['capture-the-flag-siege-of-cairo']).toBe(true)
    // Battlefield 2042 has no free version, so the question does not arise.
    expect(answer['rush-classic-arica-harbor']).toBeNull()
  })

  it('keeps an invited collaborator out of sight until they accept', async () => {
    const rows = await db
      .select()
      .from(experienceCreators)
      .innerJoin(
        experiences,
        eq(experiences.id, experienceCreators.experienceId),
      )
      .where(eq(experiences.slug, 'capture-the-flag-siege-of-cairo'))
    const creators = rows.map((row) => row.experience_creators)

    expect(creators).toHaveLength(4)
    expect(creators.filter((row) => row.name)).toHaveLength(1)
    expect(
      creators.filter((row) => row.canEdit && row.acceptedAt),
    ).toHaveLength(1)
    expect(
      creators.filter((row) => row.userId && !row.acceptedAt),
    ).toHaveLength(1)
  })
})
