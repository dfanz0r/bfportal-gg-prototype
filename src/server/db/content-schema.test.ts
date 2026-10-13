import { eq, sql as raw } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db, sql } from '.'
import {
  banners,
  categories,
  experienceImages,
  experienceLikes,
  experiences,
  experienceTags,
  playtests,
  projectFiles,
  revisions,
  siteSettings,
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
      raw`truncate ${experiences}, ${categories}, ${tags}, ${siteSettings}, ${banners}, ${user} restart identity cascade`,
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
    const [tag] = await db
      .insert(tags)
      .values({ name: 'Gun Game', slug: 'gun-game' })
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
      summary: 'Practise on moving targets',
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

    const backwards = await constraintOf(
      db.insert(banners).values(banner('ends before it starts', 2, 1)),
    )
    expect(backwards).toBe('banners_window_check')
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
