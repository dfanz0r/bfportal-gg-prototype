import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { portalExport } from '../../../tests/portal-export'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import {
  experienceCreators,
  experienceMedia,
  experiences,
  experienceTags,
  heldFiles,
  projectFiles,
  sdkVersions,
  submissionDrafts,
  tagGroups,
  tags,
  user,
} from '../db/schema'
import type { Lookup } from '../integrations/gametools'
import { allowLookup, forgetAllowances } from '../rate-limit'
import { keepDraft, readDraft } from './drafts'
import { getProjectFile } from './experience'
import { EXPERIENCE_FIELDS, submitExperience } from './experience-submissions'
import { holdFiles } from './held-files'
import { MAX_PER_DAY, MAX_WAITING } from './submission-limits'

const NOW = new Date('2026-10-13T12:00:00Z')
const creator: Actor = { id: 'seed-vantage', role: 'user' }
// Others to submit as, so no one account runs into the limit on how many it
// may have waiting.
const recruit = (n: number): Actor => ({
  id: `seed-recruit-${String(n).padStart(2, '0')}`,
  role: 'user',
})

/** What gametools would say about a Battlefield 6 code. */
const found = {
  status: 'found',
  experience: {
    playgroundId: '139588e0-c1e3-11f1-9424-e46ae39b09ae',
    code: '1abc2',
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
} satisfies Lookup
const answers = (lookup: Lookup) => ({ lookup: async () => lookup, now: NOW })

const form = (changes: Record<string, unknown> = {}) => ({
  game: 'bf6',
  code: '1ABC2',
  category: 'multiplayer',
  title: 'Rush Hour',
  description: 'Two rounds of **Rush**.',
  teamPlayers: ['16', '16'],
  teamBots: ['0', '0'],
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

  // Each test submits as many times as it needs to.
  beforeEach(() => {
    forgetAllowances()
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
        media: 'https://youtu.be/jNQXAC9IVRw\nhttps://i.example/b.png',
        credits: 'Coupe',
        copyAllowed: 'true',
        // Not a field any more; a form that still sends one is not obeyed.
        sdk: '1.0.1.0',
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
      maxBots: 0,
      teamSetup: [
        { players: 16, bots: 0 },
        { players: 16, bots: 0 },
      ],
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
    // The release is not asked for. It is the game's current one.
    const [release] = await db
      .select({ version: sdkVersions.version })
      .from(sdkVersions)
      .where(eq(sdkVersions.id, row.sdkVersionId ?? 0))
    expect(release?.version).toBe('1.4.3.0')
    expect(tagged.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'Casual', source: 'creator' },
      { name: 'Custom Logic', source: 'portal' },
      { name: 'Gun Game', source: 'creator' },
      { name: 'Hardcore', source: 'portal' },
    ])
    // Kept as typed, in order. What each shows is worked out on the page.
    expect(
      await db
        .select({ url: experienceMedia.url })
        .from(experienceMedia)
        .where(eq(experienceMedia.experienceId, row.id))
        .orderBy(experienceMedia.position),
    ).toEqual([
      { url: 'https://youtu.be/jNQXAC9IVRw' },
      { url: 'https://i.example/b.png' },
    ])
    expect(
      await db
        .select({ name: experienceCreators.name })
        .from(experienceCreators)
        .where(eq(experienceCreators.experienceId, row.id)),
    ).toEqual([{ name: 'Coupe' }])
  })

  it('keeps teams that are not even, and a team of bots', async () => {
    const result = await submitExperience(
      recruit(10),
      form({
        title: 'Practice against bots',
        teamPlayers: ['8', '0'],
        teamBots: ['0', '12'],
      }),
      answers(found),
    )
    expect(result).toMatchObject({ ok: true })
    const { row } = await stored('practice-against-bots')
    expect(row).toMatchObject({
      maxPlayers: 8,
      maxBots: 12,
      teamSetup: [
        { players: 8, bots: 0 },
        { players: 0, bots: 12 },
      ],
    })
  })

  it('asks the accounts it credits, and lists names after them', async () => {
    const result = await submitExperience(
      recruit(11),
      form({
        title: 'Made together',
        // kestrel, Gala, and the one submitting it, who is the owner.
        creditAccounts: [
          '900000000000000002',
          '900000000000000001',
          '900000000000000002',
        ],
        credits: ['Coupe'],
      }),
      answers(found),
    )
    expect(result).toMatchObject({ ok: true })
    const { row } = await stored('made-together')
    expect(
      await db
        .select({
          userId: experienceCreators.userId,
          name: experienceCreators.name,
          position: experienceCreators.position,
          canEdit: experienceCreators.canEdit,
          acceptedAt: experienceCreators.acceptedAt,
        })
        .from(experienceCreators)
        .where(eq(experienceCreators.experienceId, row.id))
        .orderBy(experienceCreators.position),
    ).toEqual([
      // Asked, not shown until they accept, and not able to edit.
      {
        userId: 'seed-kestrel',
        name: null,
        position: 0,
        canEdit: false,
        acceptedAt: null,
      },
      {
        userId: 'seed-gala',
        name: null,
        position: 1,
        canEdit: false,
        acceptedAt: null,
      },
      {
        userId: null,
        name: 'Coupe',
        position: 2,
        canEdit: false,
        acceptedAt: null,
      },
    ])
  })

  it('leaves the owner out of their own credits', async () => {
    const result = await submitExperience(
      recruit(12),
      // recruit 12's own account.
      form({ title: 'Mine alone', creditAccounts: ['900000000000000040'] }),
      answers(found),
    )
    expect(result).toMatchObject({ ok: true })
    const { row } = await stored('mine-alone')
    expect(
      await db
        .select()
        .from(experienceCreators)
        .where(eq(experienceCreators.experienceId, row.id)),
    ).toEqual([])
  })

  it('refuses an account that is not here or hides its name, and too many credits', async () => {
    expect(
      await errorsOf({ creditAccounts: ['123456789012345678'] }),
    ).toMatchObject({ credits: expect.stringContaining('no longer here') })
    expect(await errorsOf({ creditAccounts: ['not-an-id'] })).toMatchObject({
      creditAccounts: 'Choose each account from the list.',
    })
    await db
      .update(user)
      .set({ hideUsername: true })
      .where(eq(user.id, 'seed-kestrel'))
    try {
      expect(
        await errorsOf({ creditAccounts: ['900000000000000002'] }),
      ).toMatchObject({ credits: expect.stringContaining('no longer here') })
    } finally {
      await db
        .update(user)
        .set({ hideUsername: false })
        .where(eq(user.id, 'seed-kestrel'))
    }
    expect(
      await errorsOf({
        creditAccounts: ['900000000000000001', '900000000000000002'],
        credits: Array.from({ length: 9 }, (_, n) => `Name ${n}`),
      }),
    ).toMatchObject({ credits: 'Credit up to 10 people.' })
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
    expect(await errorsOf({ title: 'x' })).toHaveProperty('title')
    // No teams; a team of no one; no people at all; more than a Battlefield 6
    // match holds.
    expect(await errorsOf({ teamPlayers: [], teamBots: [] })).toHaveProperty(
      'teams',
    )
    expect(
      await errorsOf({ teamPlayers: ['8', '0'], teamBots: ['0', '0'] }),
    ).toHaveProperty('teams')
    expect(
      await errorsOf({ teamPlayers: ['0', '0'], teamBots: ['8', '8'] }),
    ).toHaveProperty('teams')
    expect(
      await errorsOf({ teamPlayers: ['40', '40'], teamBots: ['0', '0'] }),
    ).toEqual({ teams: 'A Battlefield 6 match holds up to 64 players.' })
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
    // A template with no code is its files, so it needs some.
    expect(
      await submitExperience(
        recruit(1),
        form({ code: '', title: 'Nothing to take', isTemplate: 'true' }),
        answers(found),
      ),
    ).toMatchObject({
      ok: false,
      errors: { files: expect.stringContaining('needs its export') },
    })
    const result = await submitExperience(
      recruit(1),
      form({
        code: '',
        title: 'Files only',
        isTemplate: 'true',
        filesUrl: 'https://www.dropbox.com/s/abc/files.zip',
      }),
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

  it('shares a template’s files: the export, what is inside it, and what was added', async () => {
    const who = recruit(37)
    const held = await holdFiles(
      who,
      [
        {
          slot: 'export',
          filename: 'mode.json',
          text: portalExport({
            script: 'let a = 1',
            maps: ['MP_Abbasid', 'MP_Tungsten'],
            teams: [{ players: 12 }, { players: 12 }],
          }),
        },
        { slot: 'added', filename: 'Abbasid.tscn', text: '[gd_scene]' },
      ],
      NOW,
    )
    if (!held.ok) throw new Error('expected the files to be held')
    const result = await submitExperience(
      who,
      form({
        code: '',
        title: 'Shared files',
        isTemplate: 'true',
        teamPlayers: ['12', '12'],
        files: held.held.map((file) => file.id),
      }),
      answers(found),
    )
    expect(result).toEqual({ ok: true, slug: 'shared-files' })

    const { row } = await stored('shared-files')
    // With no code, the export says what the maps are.
    expect(row).toMatchObject({
      gameMode: 'Custom',
      mapRotation: [
        { map: 'MP_Abbasid', mode: 'Custom', rounds: 1, teams: [12, 12] },
        { map: 'MP_Tungsten', mode: 'Custom', rounds: 1, teams: [12, 12] },
      ],
    })
    const files = await db
      .select({
        kind: projectFiles.kind,
        filename: projectFiles.filename,
        fromExport: projectFiles.fromExport,
        mapIndex: projectFiles.mapIndex,
      })
      .from(projectFiles)
      .where(eq(projectFiles.experienceId, row.id))
      .orderBy(projectFiles.id)
    expect(files).toEqual([
      {
        kind: 'export',
        filename: 'mode.json',
        fromExport: false,
        mapIndex: null,
      },
      {
        kind: 'script',
        filename: 'bundle.ts',
        fromExport: true,
        mapIndex: null,
      },
      {
        kind: 'strings',
        filename: 'bundle.strings.json',
        fromExport: true,
        mapIndex: null,
      },
      {
        kind: 'spatial',
        filename: 'MP_Abbasid_Test.spatial.json',
        fromExport: true,
        mapIndex: 0,
      },
      {
        kind: 'spatial',
        filename: 'MP_Tungsten_Test.spatial.json',
        fromExport: true,
        mapIndex: 1,
      },
      {
        kind: 'scene',
        filename: 'Abbasid.tscn',
        fromExport: false,
        mapIndex: null,
      },
    ])
    // Its files are stored now, and no longer held.
    expect(
      await db.select().from(heldFiles).where(eq(heldFiles.uploadedBy, who.id)),
    ).toEqual([])
  })

  it('keeps the files of one not offered as a template, for its owner to offer later', async () => {
    const who = recruit(38)
    const held = await holdFiles(
      who,
      [{ slot: 'export', filename: 'mode.json', text: portalExport() }],
      NOW,
    )
    if (!held.ok) throw new Error('expected the export to be held')
    const result = await submitExperience(
      who,
      form({ title: 'Played, not shared', files: [held.held[0].id] }),
      answers(found),
    )
    expect(result).toEqual({ ok: true, slug: 'played-not-shared' })
    const { row } = await stored('played-not-shared')
    expect(row.isTemplate).toBe(false)
    const files = await db
      .select({ id: projectFiles.publicId, kind: projectFiles.kind })
      .from(projectFiles)
      .where(eq(projectFiles.experienceId, row.id))
      .orderBy(projectFiles.id)
    expect(files.map((file) => file.kind)).toEqual(['export', 'spatial'])
    // Only its owner and the moderators can download them.
    expect(await getProjectFile(files[0].id, null)).toBeNull()
    expect(await getProjectFile(files[0].id, recruit(1))).toBeNull()
    expect(await getProjectFile(files[0].id, who)).not.toBeNull()
    expect(
      await db.select().from(heldFiles).where(eq(heldFiles.uploadedBy, who.id)),
    ).toEqual([])
  })

  it('refuses a file held for someone else, or no longer held', async () => {
    const held = await holdFiles(
      recruit(39),
      [{ slot: 'export', filename: 'mode.json', text: portalExport() }],
      NOW,
    )
    if (!held.ok) throw new Error('expected the export to be held')
    const files = [held.held[0].id]
    const message = { files: 'A file is no longer held. Add it again.' }
    expect(
      await submitExperience(
        recruit(40),
        form({ title: 'Not mine', isTemplate: 'true', files }),
        answers(found),
      ),
    ).toMatchObject({ ok: false, errors: message })
    const tomorrow = new Date(NOW.getTime() + 25 * 60 * 60 * 1000)
    expect(
      await submitExperience(
        recruit(39),
        form({ title: 'Too late', isTemplate: 'true', files }),
        { lookup: async () => found, now: tomorrow },
      ),
    ).toMatchObject({ ok: false, errors: message })

    // Let go of while Portal is asked, as another form can: refused, and
    // nothing is written.
    expect(
      await submitExperience(
        recruit(39),
        form({ title: 'Lost Meanwhile', isTemplate: 'true', files }),
        {
          lookup: async () => {
            await db.delete(heldFiles).where(eq(heldFiles.id, files[0]))
            return found
          },
          now: NOW,
        },
      ),
    ).toMatchObject({ ok: false, errors: message })
    expect(
      await db
        .select()
        .from(experiences)
        .where(eq(experiences.slug, 'lost-meanwhile')),
    ).toEqual([])
  })

  it('takes the code from Portal when given only a link', async () => {
    const link =
      'https://portal.battlefield.com/bf6/experience/teams?id=139588e0-c1e3-11f1-9424-e46ae39b09ae'
    const result = await submitExperience(
      recruit(2),
      form({ code: '', link, title: 'By link' }),
      answers(found),
    )
    expect(result).toEqual({ ok: true, slug: 'by-link' })
    expect((await stored('by-link')).row).toMatchObject({
      code: '1abc2',
      playgroundId: '139588e0-c1e3-11f1-9424-e46ae39b09ae',
    })

    // With gametools down there is no knowing the code, and it is not a
    // template, so it needs typing.
    const without = await submitExperience(
      recruit(2),
      form({ code: '', link, title: 'By link, no answer' }),
      answers({ status: 'unavailable' }),
    )
    expect(without).toMatchObject({
      ok: false,
      errors: { code: expect.stringContaining('as well') },
    })
  })

  it('gives people sending the same title at once an address each', async () => {
    const sent = await Promise.all(
      [3, 4, 5, 6].map((n) =>
        submitExperience(
          recruit(n),
          form({ title: 'Same Moment' }),
          answers(found),
        ),
      ),
    )
    expect(sent.map((result) => result.ok && result.slug).sort()).toEqual([
      'same-moment',
      'same-moment-2',
      'same-moment-3',
      'same-moment-4',
    ])
  })

  it('stops one account filling the queue', async () => {
    const eager = recruit(7)
    const send = (n: number) =>
      submitExperience(eager, form({ title: `Flood ${n}` }), answers(found))
    for (let n = 1; n <= MAX_WAITING; n += 1) {
      expect(await send(n)).toMatchObject({ ok: true })
    }
    expect(await send(MAX_WAITING + 1)).toMatchObject({
      ok: false,
      reason: 'invalid',
      errors: { form: expect.stringContaining('waiting for a moderator') },
    })
    // A moderator is trusted with their own queue.
    expect(
      await submitExperience(
        { id: eager.id, role: 'moderator' },
        form({ title: 'Flood as staff' }),
        answers(found),
      ),
    ).toMatchObject({ ok: true })
  })

  it('stops one account sending all day', async () => {
    const busy = recruit(8)
    // Ten sent in the last day, all of them already looked at.
    for (let n = 1; n <= MAX_PER_DAY; n += 1) {
      const result = await submitExperience(
        { id: busy.id, role: 'moderator' },
        form({ title: `Busy ${n}` }),
        answers(found),
      )
      expect(result).toMatchObject({ ok: true })
    }
    await db
      .update(experiences)
      .set({ status: 'published' })
      .where(eq(experiences.ownerId, busy.id))

    expect(
      await submitExperience(busy, form({ title: 'One more' }), answers(found)),
    ).toMatchObject({
      ok: false,
      errors: { form: expect.stringContaining('last day') },
    })
    // Deleting one does not give its place back.
    await db
      .update(experiences)
      .set({ deletedAt: NOW })
      .where(eq(experiences.ownerId, busy.id))
    expect(
      await submitExperience(busy, form({ title: 'One more' }), answers(found)),
    ).toMatchObject({
      ok: false,
      errors: { form: expect.stringContaining('last day') },
    })
    // Tomorrow is another day.
    const tomorrow = new Date(NOW.getTime() + 25 * 60 * 60 * 1000)
    expect(
      await submitExperience(busy, form({ title: 'One more' }), {
        ...answers(found),
        now: tomorrow,
      }),
    ).toMatchObject({ ok: true })
  })

  it('asks Portal no more often by submitting than by fetching details', async () => {
    const eager = recruit(9)
    // The minute's lookups spent, as "Fetch details" spends them.
    while (allowLookup(eager.id)) {}
    let asked = 0
    const counting = {
      lookup: async (): Promise<Lookup> => {
        asked += 1
        return { status: 'missing' }
      },
      now: NOW,
    }
    expect(
      await submitExperience(
        eager,
        form({ title: 'Guessing', code: 'zzzz9' }),
        counting,
      ),
    ).toMatchObject({
      ok: false,
      reason: 'invalid',
      errors: { code: expect.stringContaining('a lot of lookups') },
    })
    expect(asked).toBe(0)
  })

  it('takes one tag from a group set to one choice', async () => {
    await db
      .update(tagGroups)
      .set({ pick: 'one' })
      .where(and(eq(tagGroups.game, 'bf6'), eq(tagGroups.name, 'Style')))
    try {
      expect(
        await submitExperience(
          recruit(9),
          form({ title: 'Two styles', tags: ['casual', 'competitive'] }),
          answers(found),
        ),
      ).toMatchObject({
        ok: false,
        errors: { tags: 'Choose only one under Style.' },
      })
      expect(
        await submitExperience(
          recruit(9),
          // One style, and as many topics as fit.
          form({ title: 'One style', tags: ['casual', 'zombies', 'training'] }),
          answers(found),
        ),
      ).toMatchObject({ ok: true })
    } finally {
      await db
        .update(tagGroups)
        .set({ pick: 'any' })
        .where(eq(tagGroups.game, 'bf6'))
    }
  })

  it('keeps a refused form for its sender, until one of theirs goes through', async () => {
    const sender = recruit(9)
    await keepDraft(
      sender,
      'experience',
      { title: 'x', tags: ['casual'] },
      { title: 'Too short.' },
      EXPERIENCE_FIELDS,
    )

    expect(await readDraft(sender, 'experience')).toEqual({
      fields: { title: 'x', tags: ['casual'] },
      errors: { title: 'Too short.' },
    })
    // It is the experience form's, and someone else has none.
    expect(await readDraft(sender, 'snippet')).toBeNull()
    expect(await readDraft(recruit(1), 'experience')).toBeNull()

    await submitExperience(
      sender,
      form({ title: 'Fixed and sent' }),
      answers(found),
    )
    expect(await readDraft(sender, 'experience')).toBeNull()
  })

  it("keeps only the form's own fields, and lets what was refused go when it is too much", async () => {
    const sender = recruit(9)
    await keepDraft(
      sender,
      'experience',
      {
        title: 'Kept',
        description: 'x'.repeat(150_000),
        // Valid, and longer than the title: still kept.
        media: 'https://i.example/a.png',
        back: '/somewhere',
        upload: { name: 'not text' },
        tags: ['casual', 7],
      },
      { description: 'Keep the description to 10,000 characters.' },
      EXPERIENCE_FIELDS,
    )

    expect(await readDraft(sender, 'experience')).toEqual({
      fields: {
        title: 'Kept',
        media: 'https://i.example/a.png',
        tags: ['casual'],
      },
      errors: { description: 'Keep the description to 10,000 characters.' },
    })
    await db.delete(submissionDrafts)
  })

  it("leaves out tags that are not this game's to choose", async () => {
    await submitExperience(
      recruit(1),
      // "race" is a 2042 topic; "custom-logic" is Portal's to set.
      form({ title: 'Tag test', tags: ['race', 'zombies', 'nonsense'] }),
      answers({ status: 'unavailable' }),
    )
    const { tags: tagged } = await stored('tag-test')
    expect(tagged).toEqual([{ name: 'Zombies', source: 'creator' }])
  })

  it('matches 2042 maps by name, and takes their eras', async () => {
    const result = await submitExperience(
      recruit(1),
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

  it('takes a template from the category where a game has no export', async () => {
    const unavailable = answers({ status: 'unavailable' })
    // Its form has no "offer it as a template", so one sent anyway does not
    // excuse the missing code, and does not make it a template.
    const noCode = await submitExperience(
      recruit(1),
      form({ game: 'bf2042', code: '', title: 'No code', isTemplate: 'true' }),
      unavailable,
    )
    expect(noCode).toMatchObject({
      ok: false,
      errors: { code: expect.stringContaining('link') },
    })

    await submitExperience(
      recruit(1),
      form({
        game: 'bf2042',
        code: 'AAZZ98',
        title: 'Only said so',
        isTemplate: 'true',
        filesUrl: 'https://github.com/someone/files',
      }),
      unavailable,
    )
    expect((await stored('only-said-so')).row).toMatchObject({
      isTemplate: false,
      filesUrl: null,
    })

    await submitExperience(
      recruit(1),
      form({
        game: 'bf2042',
        code: 'AAZZ97',
        title: 'Drill range',
        category: 'templates',
      }),
      unavailable,
    )
    expect((await stored('drill-range')).row).toMatchObject({
      isTemplate: true,
    })
  })
})
