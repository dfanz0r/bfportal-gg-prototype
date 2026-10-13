import { eq, sql as raw } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db, sql } from '.'
import {
  banners,
  categories,
  experienceCreators,
  experienceImages,
  experienceLikes,
  experiences,
  experienceTags,
  maps,
  mapTags,
  playtests,
  projectFiles,
  revisions,
  sdkVersions,
  siteSettings,
  tagAliases,
  tagGroups,
  tags,
  updates,
  user,
} from './schema'

/** The Postgres error behind a failed query, whatever wraps it. */
async function constraintOf(query: Promise<unknown>) {
  try {
    await query
  } catch (error) {
    let current = error as { constraint_name?: string; cause?: unknown }
    while (current && !current.constraint_name && current.cause) {
      current = current.cause as typeof current
    }
    return current?.constraint_name
  }
  return undefined
}

async function tagGroup(game: 'bf2042' | 'bf6', name: string) {
  const [group] = await db
    .insert(tagGroups)
    .values({ game, name, slug: name.toLowerCase() })
    .returning()
  return group
}

async function seed() {
  await db.insert(user).values({
    id: 'user-1',
    name: 'Recruit',
    email: '1@discord.invalid',
    discordId: '1',
    discordUsername: 'recruit',
  })
  const [category] = await db
    .insert(categories)
    .values({
      kind: 'experience_main',
      name: 'Multiplayer',
      slug: 'multiplayer',
    })
    .returning()
  const [experience] = await db
    .insert(experiences)
    .values({
      slug: 'gun-master',
      game: 'bf6',
      title: 'Gun Master',
      ownerId: 'user-1',
      categoryId: category.id,
    })
    .returning()
  return { category, experience }
}

describe('content schema', () => {
  beforeEach(async () => {
    await db.execute(
      raw`truncate ${experiences}, ${categories}, ${tagGroups}, ${maps}, ${sdkVersions}, ${siteSettings}, ${banners}, ${user} restart identity cascade`,
    )
  })

  afterAll(async () => {
    await sql.end()
  })

  it('starts a submission as pending with nothing published', async () => {
    const { experience } = await seed()

    expect(experience).toMatchObject({
      status: 'pending',
      firstPublishedAt: null,
      announcedAt: null,
      deletedAt: null,
      featured: false,
      isTemplate: false,
      types: [],
      // Nothing has looked it up on Portal yet, and nobody has flagged it.
      portalState: 'unchecked',
      portalCheckedAt: null,
      broken: false,
    })
    expect(experience.submittedAt).toBeInstanceOf(Date)
  })

  it('records what an experience is built with', async () => {
    const { experience } = await seed()

    const [updated] = await db
      .update(experiences)
      .set({ types: ['script', 'spatial'] })
      .where(eq(experiences.id, experience.id))
      .returning()
    expect(updated.types).toEqual(['script', 'spatial'])

    const scripted = await db
      .select({ id: experiences.id })
      .from(experiences)
      .where(raw`${experiences.types} @> '{script}'`)
    expect(scripted).toEqual([{ id: experience.id }])
  })

  it('keeps an id supplied by the import and continues after it', async () => {
    const { category } = await seed()

    await db.insert(experiences).values({
      id: 9001,
      slug: 'from-the-old-site',
      game: 'bf2042',
      title: 'From the old site',
      ownerId: 'user-1',
      categoryId: category.id,
    })
    await db.execute(
      raw`select setval(pg_get_serial_sequence('experiences', 'id'), (select max(id) from experiences))`,
    )
    const [next] = await db
      .insert(experiences)
      .values({
        slug: 'made-here',
        game: 'bf6',
        title: 'Made here',
        ownerId: 'user-1',
        categoryId: category.id,
      })
      .returning()

    expect(next.id).toBe(9002)
  })

  it('allows one like per user per experience', async () => {
    const { experience } = await seed()
    const like = { experienceId: experience.id, userId: 'user-1' }
    await db.insert(experienceLikes).values(like)

    const constraint = await constraintOf(
      db.insert(experienceLikes).values(like),
    )

    expect(constraint).toBe('experience_likes_experience_id_user_id_pk')
  })

  it('allows one pending revision per experience, and more once it is reviewed', async () => {
    const { experience } = await seed()
    const edit = {
      experienceId: experience.id,
      kind: 'edit' as const,
      payload: { title: 'Gun Master 2.0' },
      submittedBy: 'user-1',
    }
    const [first] = await db.insert(revisions).values(edit).returning()

    const constraint = await constraintOf(db.insert(revisions).values(edit))
    expect(constraint).toBe('revisions_one_pending_per_experience')

    await db
      .update(revisions)
      .set({ status: 'approved' })
      .where(eq(revisions.id, first.id))
    await db.insert(revisions).values(edit)
    expect(await db.select().from(revisions)).toHaveLength(2)
  })

  it('refuses the same slug twice, across both games', async () => {
    const { category } = await seed()

    const constraint = await constraintOf(
      db.insert(experiences).values({
        slug: 'gun-master',
        game: 'bf2042',
        title: 'Gun Master',
        ownerId: 'user-1',
        categoryId: category.id,
      }),
    )

    expect(constraint).toBe('experiences_slug_unique')
  })

  it('removes likes, tags and revisions with their experience', async () => {
    const { experience } = await seed()
    const topic = await tagGroup('bf6', 'Topic')
    const [tag] = await db
      .insert(tags)
      .values({
        game: 'bf6',
        groupId: topic.id,
        name: 'Gun Game',
        slug: 'gun-game',
      })
      .returning()
    await db
      .insert(experienceLikes)
      .values({ experienceId: experience.id, userId: 'user-1' })
    await db
      .insert(experienceTags)
      .values({ experienceId: experience.id, tagId: tag.id })
    await db.insert(revisions).values({
      experienceId: experience.id,
      kind: 'clear_flags',
      payload: {},
      submittedBy: 'user-1',
    })

    await db.delete(experiences).where(eq(experiences.id, experience.id))

    expect(await db.select().from(experienceLikes)).toHaveLength(0)
    expect(await db.select().from(experienceTags)).toHaveLength(0)
    expect(await db.select().from(revisions)).toHaveLength(0)
    expect(await db.select().from(tags)).toHaveLength(1)
  })

  it("keeps a tag inside one game and one of that game's groups", async () => {
    const rules = await tagGroup('bf6', 'Rules')
    const oldRules = await tagGroup('bf2042', 'Rules')
    const scripted = { name: 'Custom scripted', slug: 'custom-scripted' }
    await db
      .insert(tags)
      .values({ game: 'bf6', groupId: rules.id, ...scripted })

    // The same name means something else in the other game.
    await db
      .insert(tags)
      .values({ game: 'bf2042', groupId: oldRules.id, ...scripted })

    expect(
      await constraintOf(
        db.insert(tags).values({ game: 'bf6', groupId: rules.id, ...scripted }),
      ),
    ).toBe('tags_game_name_unique')
    expect(
      await constraintOf(
        db.insert(tags).values({
          game: 'bf6',
          groupId: oldRules.id,
          name: 'Hardcore',
          slug: 'hardcore',
        }),
      ),
    ).toBe('tags_group_fk')
    expect(
      await constraintOf(
        db.delete(tagGroups).where(eq(tagGroups.id, rules.id)),
      ),
    ).toBe('tags_group_fk')
  })

  it('finds a tag by an old name, within its game', async () => {
    const era = await tagGroup('bf2042', 'Era')
    const [bc2] = await db
      .insert(tags)
      .values({ game: 'bf2042', groupId: era.id, name: 'BC2', slug: 'bc2' })
      .returning()
    await db
      .insert(tagAliases)
      .values({ game: 'bf2042', alias: 'bfbc2', tagId: bc2.id })

    expect(
      await constraintOf(
        db
          .insert(tagAliases)
          .values({ game: 'bf2042', alias: 'BFBC2', tagId: bc2.id }),
      ),
    ).toBe('tag_aliases_lower_check')
    // An alias cannot point at another game's tag.
    expect(
      await constraintOf(
        db
          .insert(tagAliases)
          .values({ game: 'bf6', alias: 'bc2', tagId: bc2.id }),
      ),
    ).toBe('tag_aliases_tag_fk')

    await db.delete(tags).where(eq(tags.id, bc2.id))
    expect(await db.select().from(tagAliases)).toHaveLength(0)
  })

  it("tags a map, and records where an experience's tag came from", async () => {
    const { experience } = await seed()
    const era = await tagGroup('bf6', 'Era')
    const [tag] = await db
      .insert(tags)
      .values({ game: 'bf6', groupId: era.id, name: 'BF3', slug: 'bf3' })
      .returning()
    const [map] = await db
      .insert(maps)
      .values({ game: 'bf6', name: 'Caspian Border' })
      .returning()
    await db.insert(mapTags).values({ mapId: map.id, tagId: tag.id })

    const [chosen] = await db
      .insert(experienceTags)
      .values({ experienceId: experience.id, tagId: tag.id })
      .returning()
    expect(chosen.source).toBe('creator')

    // Gametools gives a 2042 map no level id, so several maps may lack one.
    await db.insert(maps).values({ game: 'bf6', name: 'Arica Harbor' })
    expect(
      await constraintOf(
        db.insert(maps).values({ game: 'bf6', name: 'Caspian Border' }),
      ),
    ).toBe('maps_game_name_unique')
  })

  it('records the SDK release an experience works with, for its own game', async () => {
    const { experience } = await seed()
    const [current, old2042] = await db
      .insert(sdkVersions)
      .values([
        { game: 'bf6', version: '1.4.3.0', season: 'Season 4', sortOrder: 14 },
        { game: 'bf2042', version: '1.4.3.0', sortOrder: 1 },
      ])
      .returning()

    await db
      .update(experiences)
      .set({ sdkVersionId: current.id })
      .where(eq(experiences.id, experience.id))

    expect(
      await constraintOf(
        db
          .update(experiences)
          .set({ sdkVersionId: old2042.id })
          .where(eq(experiences.id, experience.id)),
      ),
    ).toBe('experiences_sdk_version_fk')
    // A release in use cannot be removed from under the experiences on it.
    expect(
      await constraintOf(
        db.delete(sdkVersions).where(eq(sdkVersions.id, current.id)),
      ),
    ).toBe('experiences_sdk_version_fk')
  })

  it('credits a creator by name or by account, never both', async () => {
    const { experience } = await seed()
    await db.insert(user).values({
      id: 'user-2',
      name: 'Gala',
      email: '2@discord.invalid',
      discordId: '2',
      discordUsername: 'gala',
    })
    const on = { experienceId: experience.id }

    const [credit, invite] = await db
      .insert(experienceCreators)
      .values([
        { ...on, name: 'someone without an account' },
        { ...on, userId: 'user-2' },
      ])
      .returning()
    // An added account is a credit. It waits to be accepted, and it cannot
    // edit unless the owner says so.
    expect(invite).toMatchObject({ acceptedAt: null, canEdit: false })
    expect(credit.userId).toBeNull()
    expect(
      await constraintOf(
        db
          .update(experienceCreators)
          .set({ canEdit: true })
          .where(eq(experienceCreators.id, credit.id)),
      ),
    ).toBe('experience_creators_edit_check')

    expect(
      await constraintOf(
        db.insert(experienceCreators).values({ ...on, userId: 'user-2' }),
      ),
    ).toBe('experience_creators_user_unique')
    expect(
      await constraintOf(
        db
          .insert(experienceCreators)
          .values({ ...on, userId: 'user-1', name: 'Recruit' }),
      ),
    ).toBe('experience_creators_one_kind_check')
    expect(await constraintOf(db.insert(experienceCreators).values(on))).toBe(
      'experience_creators_one_kind_check',
    )
  })

  it('will not delete a user who owns an experience', async () => {
    await seed()

    const constraint = await constraintOf(
      db.delete(user).where(eq(user.id, 'user-1')),
    )

    expect(constraint).toBe('experiences_owner_id_user_id_fk')
  })

  it('keeps gallery images in order, one per position', async () => {
    const { experience } = await seed()
    const image = (position: number, name: string) => ({
      experienceId: experience.id,
      position,
      url: `https://example.com/${name}.png`,
    })
    await db
      .insert(experienceImages)
      .values([image(2, 'scoreboard'), image(1, 'map')])

    const clash = await constraintOf(
      db.insert(experienceImages).values(image(1, 'another')),
    )
    expect(clash).toBe('experience_images_experience_id_position_pk')

    const stored = await db
      .select()
      .from(experienceImages)
      .orderBy(experienceImages.position)
    expect(stored.map((row) => row.url)).toEqual([
      'https://example.com/map.png',
      'https://example.com/scoreboard.png',
    ])
  })

  it('stores a shared file with its project and removes it with it', async () => {
    const { experience } = await seed()
    const file = {
      kind: 'script' as const,
      filename: 'Script.ts',
      sizeBytes: 21,
      sha256: 'a'.repeat(64),
      body: 'mod.OnGameModeStarted()',
      uploadedBy: 'user-1',
    }

    const orphan = await constraintOf(db.insert(projectFiles).values(file))
    expect(orphan).toBe('project_files_one_project_check')

    await db
      .insert(projectFiles)
      .values({ ...file, experienceId: experience.id, fromExport: true })
    await db.delete(experiences).where(eq(experiences.id, experience.id))
    expect(await db.select().from(projectFiles)).toHaveLength(0)
  })

  it('holds a playtest for a moderator, for an experience or a named one', async () => {
    const { experience } = await seed()
    const call = {
      game: 'bf6' as const,
      code: '1V4MX',
      summary: 'Practice on moving targets',
      hostId: 'user-1',
      regions: ['eu', 'asia'] as ('eu' | 'asia')[],
    }

    const nameless = await constraintOf(db.insert(playtests).values(call))
    expect(nameless).toBe('playtests_subject_check')

    // Something with no page yet is named by its title.
    await db
      .insert(playtests)
      .values({ ...call, title: 'Three-squad extraction' })
    const [playtest] = await db
      .insert(playtests)
      .values({ ...call, experienceId: experience.id })
      .returning()
    expect(playtest).toMatchObject({
      status: 'pending',
      regions: ['eu', 'asia'],
      closesAt: null,
      announcedAt: null,
      discordUrl: null,
    })

    const forEurope = await db
      .select({ id: playtests.id })
      .from(playtests)
      .where(
        raw`${playtests.regions} @> '{eu}' and ${playtests.experienceId} is not null`,
      )
    expect(forEurope).toEqual([{ id: playtest.id }])
  })

  it('shows a banner only inside its time window', async () => {
    await seed()
    const hour = 60 * 60 * 1000
    const now = Date.now()
    const banner = (message: string, from: number, to: number) => ({
      message,
      startsAt: new Date(now + from * hour),
      endsAt: new Date(now + to * hour),
      createdBy: 'user-1',
    })
    await db
      .insert(banners)
      .values([
        banner('over', -5, -1),
        banner('showing', -1, 2),
        banner('not yet', 1, 4),
      ])

    const showing = await db
      .select({ message: banners.message })
      .from(banners)
      .where(raw`now() >= ${banners.startsAt} and now() < ${banners.endsAt}`)
    expect(showing).toEqual([{ message: 'showing' }])

    const backward = await constraintOf(
      db.insert(banners).values(banner('ends before it starts', 2, 1)),
    )
    expect(backward).toBe('banners_window_check')
  })

  it('ties an update post to exactly one project', async () => {
    const { experience } = await seed()
    const post = {
      authorId: 'user-1',
      title: 'Version 1.1',
      bodyMd: 'Shorter rounds.',
      bodyHtml: '<p>Shorter rounds.</p>',
    }

    const orphan = await constraintOf(db.insert(updates).values(post))
    expect(orphan).toBe('updates_one_project_check')

    const [held] = await db
      .insert(updates)
      .values({ ...post, experienceId: experience.id })
      .returning()
    expect(held.status).toBe('pending')
    await db.delete(experiences).where(eq(experiences.id, experience.id))
    expect(await db.select().from(updates)).toHaveLength(0)
  })

  it('holds a single row of site settings', async () => {
    await db.insert(siteSettings).values({})

    const constraint = await constraintOf(db.insert(siteSettings).values({}))

    expect(constraint).toBe('site_settings_pkey')
    expect(await db.select().from(siteSettings)).toMatchObject([
      { needLoginToViewProfile: false, homeContentMd: '' },
    ])
  })
})
