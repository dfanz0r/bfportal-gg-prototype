import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import {
  experienceCreators,
  experienceImages,
  experiences,
  experienceTags,
  tags,
} from '../db/schema'
import type { Lookup } from '../integrations/gametools'
import { submitExperience } from './submissions'

const NOW = new Date('2026-10-13T12:00:00Z')
const creator: Actor = { id: 'seed-vantage', role: 'user' }

/** What gametools would say about a Battlefield 6 code. */
const found: Lookup = {
  status: 'found',
  experience: {
    playgroundId: '139588e0-c1e3-11f1-9424-e46ae39b09ae',
    title: 'Whatever Portal calls it',
    description: '',
    thumbnailUrl: 'https://eaassets-a.akamaihd.net/thumb.jpg',
    published: true,
    rotation: [
      {
        levelId: 'MP_Abbasid',
        name: 'Siege of Cairo',
        mode: 'Rush',
        rounds: 2,
        teams: [16, 16],
      },
    ],
    tags: ['custom_scripted', 'hardcore'],
    xpMode: 'portal-unranked',
    requiresFullGame: true,
  },
}
const answers = (lookup: Lookup) => ({ lookup: async () => lookup, now: NOW })

const form = (changes: Record<string, unknown> = {}) => ({
  game: 'bf6',
  code: '1ABC2',
  category: 'multiplayer',
  title: 'Rush Hour',
  description: 'Two rounds of **Rush**.',
  maxPlayers: '32',
  ...changes,
})

async function stored(slug: string) {
  const [row] = await db
    .select()
    .from(experiences)
    .where(eq(experiences.slug, slug))
  const tagRows = await db
    .select({ name: tags.name, source: experienceTags.source })
    .from(experienceTags)
    .innerJoin(tags, eq(tags.id, experienceTags.tagId))
    .where(eq(experienceTags.experienceId, row.id))
  return { row, tags: tagRows }
}

const errorsOf = async (
  changes: Record<string, unknown>,
  lookup: Lookup = found,
) => {
  const result = await submitExperience(creator, form(changes), answers(lookup))
  return result.ok ? null : result.errors
}

describe('submitting an experience', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('refuses a visitor who is not signed in', async () => {
    expect(await submitExperience(null, form(), answers(found))).toEqual({
      ok: false,
      reason: 'signed-out',
    })
  })

  it('creates a pending experience, with what Portal says about the code', async () => {
    const result = await submitExperience(
      creator,
      form({
        tags: ['gun-game', 'casual'],
        built: ['script'],
        images: 'https://i.example/a.png\nhttps://i.example/b.png',
        credits: 'Coupe',
        copyAllowed: 'true',
        sdk: '1.4.3.0',
      }),
      answers(found),
    )
    expect(result).toEqual({ ok: true, slug: 'rush-hour' })

    const { row, tags: tagged } = await stored('rush-hour')
    expect(row).toMatchObject({
      status: 'pending',
      ownerId: creator.id,
      game: 'bf6',
      code: '1abc2',
      title: 'Rush Hour',
      descriptionHtml: '<p>Two rounds of <strong>Rush</strong>.</p>',
      maxPlayers: 32,
      types: ['script'],
      copyAllowed: true,
      firstPublishedAt: null,
      // From the lookup, not from the form.
      playgroundId: '139588e0-c1e3-11f1-9424-e46ae39b09ae',
      coverImgUrl: 'https://eaassets-a.akamaihd.net/thumb.jpg',
      gameMode: 'Rush',
      mapRotation: [
        { map: 'MP_Abbasid', mode: 'Rush', rounds: 2, teams: [16, 16] },
      ],
      xpMode: 'portal-unranked',
      requiresFullGame: true,
      portalState: 'published',
    })
    expect(row.sdkVersionId).not.toBeNull()
    expect(tagged.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'Casual', source: 'creator' },
      { name: 'Custom Logic', source: 'portal' },
      { name: 'Gun Game', source: 'creator' },
      { name: 'Hardcore', source: 'portal' },
    ])
    expect(
      await db
        .select({ url: experienceImages.url })
        .from(experienceImages)
        .where(eq(experienceImages.experienceId, row.id)),
    ).toHaveLength(2)
    expect(
      await db
        .select({ name: experienceCreators.name })
        .from(experienceCreators)
        .where(eq(experienceCreators.experienceId, row.id)),
    ).toEqual([{ name: 'Coupe' }])
  })

  it('gives a second one with the same title its own address', async () => {
    const result = await submitExperience(creator, form(), answers(found))
    expect(result).toEqual({ ok: true, slug: 'rush-hour-2' })
  })

  it('says what is wrong with a form it cannot accept', async () => {
    expect(await errorsOf({ code: 'aat4kd' })).toHaveProperty('code')
    expect(await errorsOf({ code: '' })).toHaveProperty('code')
    expect(await errorsOf({ category: 'nope' })).toHaveProperty('category')
    // A Battlefield 2042 category.
    expect(await errorsOf({ category: 'templates' })).toHaveProperty('category')
    expect(await errorsOf({ built: ['verified', 'script'] })).toHaveProperty(
      'built',
    )
    expect(await errorsOf({ sdk: '9.9.9.9' })).toHaveProperty('sdk')
    expect(await errorsOf({ title: 'x' })).toHaveProperty('title')
    expect(
      await errorsOf({
        code: '',
        link: 'https://portal.battlefield.com/experience/rules?playgroundId=139588e0-c1e3-11f1-9424-e46ae39b09ae',
      }),
    ).toHaveProperty('link')
  })

  it('refuses a code Portal does not have, and nothing else about Portal', async () => {
    expect(await errorsOf({}, { status: 'missing' })).toEqual({
      code: 'Portal has no experience with this code.',
    })

    // gametools not answering says nothing about the code.
    const result = await submitExperience(
      creator,
      form({ title: 'While gametools was down' }),
      answers({ status: 'unavailable' }),
    )
    expect(result).toMatchObject({ ok: true })
    const { row } = await stored('while-gametools-was-down')
    expect(row).toMatchObject({
      portalState: 'unchecked',
      mapRotation: null,
      requiresFullGame: null,
    })
  })

  it('takes a template with no code, and nothing else without one', async () => {
    const result = await submitExperience(
      creator,
      form({ code: '', title: 'Files only', isTemplate: 'true' }),
      answers(found),
    )
    expect(result).toEqual({ ok: true, slug: 'files-only' })
    const { row } = await stored('files-only')
    expect(row).toMatchObject({
      code: null,
      isTemplate: true,
      portalState: 'unchecked',
    })
  })

  it("leaves out tags that are not this game's to choose", async () => {
    await submitExperience(
      creator,
      // "race" is a 2042 topic; "custom-logic" is Portal's to set.
      form({ title: 'Tag test', tags: ['race', 'zombies', 'nonsense'] }),
      answers({ status: 'unavailable' }),
    )
    const { tags: tagged } = await stored('tag-test')
    expect(tagged).toEqual([{ name: 'Zombies', source: 'creator' }])
  })

  it('matches 2042 maps by name, and takes their eras', async () => {
    const result = await submitExperience(
      creator,
      form({
        game: 'bf2042',
        code: 'AAZZ99',
        title: 'Harbor Rush',
        // Battlefield 6 fields a 2042 form would not send are ignored.
        built: ['script'],
      }),
      answers({
        status: 'found',
        experience: {
          ...found.experience,
          playgroundId: null,
          requiresFullGame: null,
          tags: ['no_vehicles'],
          rotation: [
            {
              levelId: null,
              name: 'Arica Harbor',
              mode: 'Rush',
              rounds: 1,
              teams: [32],
            },
            {
              levelId: null,
              name: 'A map nobody knows',
              mode: 'Rush',
              rounds: 1,
              teams: [32],
            },
          ],
        },
      }),
    )
    expect(result).toEqual({ ok: true, slug: 'harbor-rush' })

    const { row, tags: tagged } = await stored('harbor-rush')
    expect(row).toMatchObject({
      game: 'bf2042',
      types: [],
      requiresFullGame: null,
      mapRotation: [
        { map: 'MP_Harbor', mode: 'Rush', rounds: 1, teams: [32] },
        { map: 'A map nobody knows', mode: 'Rush', rounds: 1, teams: [32] },
      ],
    })
    expect(tagged).toContainEqual({ name: 'BC2', source: 'map' })
    expect(tagged).toContainEqual({ name: 'NO VEHICLES', source: 'portal' })
  })
})
