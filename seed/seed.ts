import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { like, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { z } from 'zod'

import * as schema from '../src/server/db/schema'
import type { ExperienceType, Game } from '../src/shared/content'
import type { Role } from '../src/shared/roles'
import {
  bf6Maps,
  bf2042Maps,
  eraTagIds,
  experienceCategories,
  scriptCategories,
  sdkReleases,
  tagAliases,
  tagGroups,
} from './reference'
import * as sample from './sample'

// Fills an empty development database with sample content: the rows the site
// needs to work at all (categories, tags, maps, SDK releases), 34 real
// Battlefield 6 experiences, and made-up content covering the states a page
// has to handle. Run it with `pnpm db:seed`.
//
// It clears every content table first. Accounts it did not create are left
// alone, so a developer stays signed in.

type Db = PostgresJsDatabase<typeof schema>

const DAY = 24 * 60 * 60 * 1000

const rotationSchema = z.array(
  z.object({
    map: z.string(),
    mode: z.string(),
    rounds: z.number(),
    teams: z.array(z.number()),
  }),
)

const bf6Schema = z.object({
  experiences: z.array(
    z.object({
      code: z.string(),
      title: z.string(),
      description: z.string(),
      playgroundId: z.string(),
      thumbnailUrl: z.string(),
      likes: z.number(),
      created: z.coerce.date(),
      updated: z.coerce.date(),
      xpMode: z.string(),
      premium: z.boolean(),
      creator: z.object({
        kind: z.enum(['player', 'trusted']),
        name: z.string(),
      }),
      players: z.number(),
      tags: z.array(z.string()),
      files: z.array(z.string()).optional(),
      hasRules: z.boolean().optional(),
      rotation: rotationSchema,
    }),
  ),
})

const portalTagsSchema = z.object({
  bf2042: z.array(
    z.object({ id: z.string(), name: z.string(), description: z.string() }),
  ),
  bf6: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      nameFrom: z.enum(['ea', 'guess']),
    }),
  ),
})

function readJson<T>(file: string, shape: z.ZodType<T>) {
  const text = readFileSync(new URL(file, import.meta.url), 'utf8')
  return shape.parse(JSON.parse(text))
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Sample text as HTML: escaped, one paragraph per blank line. A stand-in for
 * the Markdown renderer, which the seed should call once it exists.
 */
function textToHtml(text: string) {
  const escapeHtml = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
  return text
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim())
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`,
    )
    .join('\n')
}

/** A lookup that names what is missing, so a typo in the data is findable. */
function lookup<T>(what: string, entries: Iterable<[string, T]>) {
  const map = new Map(entries)
  return (key: string) => {
    const value = map.get(key)
    if (value === undefined) {
      throw new Error(
        `Seed data refers to ${what} "${key}", which is not there`,
      )
    }
    return value
  }
}

/** What a real experience is built with, as far as its lookup shows. */
function typesOf(experience: {
  tags: string[]
  files?: string[]
  hasRules?: boolean
}): ExperienceType[] {
  const files = experience.files ?? []
  const types: ExperienceType[] = []
  if (files.some((file) => file.endsWith('.ts'))) types.push('script')
  if (experience.hasRules) types.push('blocks')
  if (files.some((file) => file.includes('.spatial.'))) types.push('spatial')
  if (types.length > 0) return types
  // Portal's "Custom Logic" tag does not say whether it is a script or blocks.
  if (experience.tags.includes('custom_scripted')) return ['script']
  return experience.tags.includes('Core_Modes') ? ['verified'] : []
}

export async function seed(db: Db, now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY)
  const bf6 = readJson('./bf6-experiences.json', bf6Schema)
  const portalTags = readJson('./portal-tags.json', portalTagsSchema)
  const {
    user,
    categories,
    sdkVersions,
    tagGroups: tagGroupsTable,
    tags,
    tagAliases: tagAliasesTable,
    maps,
    mapTags,
    experiences,
    experienceTags,
    experienceImages,
    experienceCreators,
    experienceLikes,
    experienceReports,
    revisions,
    projectFiles,
    snippets,
    snippetLikes,
    updates,
    playtests,
    events,
    eventInterest,
    banners,
    siteSettings,
  } = schema

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`truncate ${experiences}, ${snippets}, ${categories}, ${tagGroupsTable}, ${maps}, ${sdkVersions}, ${events}, ${banners}, ${playtests}, ${updates}, ${siteSettings} restart identity cascade`,
    )
    await tx.delete(user).where(like(user.id, 'seed-%'))

    // People: the made-up ones, one per real creator, and a crowd to do the
    // liking and reporting.
    const creatorNames = [
      ...new Set(bf6.experiences.map((e) => e.creator.name)),
    ]
    const crowd = Array.from({ length: 40 }, (_, index) => {
      const number = String(index + 1).padStart(2, '0')
      return { key: `recruit-${number}`, name: `Recruit ${number}` }
    })
    const people: { key: string; name: string; role?: Role }[] = [
      ...sample.people,
      ...creatorNames.map((name) => ({ key: slugify(name), name })),
      ...crowd,
    ]
    await tx.insert(user).values(
      people.map((person, index) => ({
        id: `seed-${person.key}`,
        name: person.name,
        email: `${person.key}@seed.invalid`,
        // Shaped like a Discord id, in a range no real account has.
        discordId: `9${String(index).padStart(17, '0')}`,
        discordUsername: person.name.toLowerCase(),
        role: person.role ?? 'user',
        createdAt: ago(900),
      })),
    )
    const userId = (key: string) => `seed-${key}`
    const everyone = people.map((person) => userId(person.key))
    const moderator = userId('kestrel')
    /** `count` people other than `except`, a different set for each `seed`. */
    const pick = (count: number, except: string, seedNumber: number) => {
      const pool = everyone.filter((id) => id !== except)
      const start = (seedNumber * 7) % pool.length
      return Array.from(
        { length: Math.min(count, pool.length) },
        (_, index) => pool[(start + index) % pool.length],
      )
    }

    // Categories.
    const categoryRows = await tx
      .insert(categories)
      .values([
        ...experienceCategories.map((category, index) => ({
          kind: 'experience_main' as const,
          game: category.game,
          name: category.name,
          slug: slugify(category.name),
          sortOrder: index,
        })),
        ...scriptCategories.map((name, index) => ({
          kind: 'script_main' as const,
          game: 'bf6' as const,
          name,
          slug: slugify(name),
          sortOrder: index,
        })),
      ])
      .returning()
    const categoryId = lookup(
      'the category',
      categoryRows.map((row) => [row.name, row.id]),
    )

    // SDK releases.
    const releases = sdkReleases.flatMap((release) =>
      release.versions.map((version) => ({ version, season: release.season })),
    )
    const sdkRows = await tx
      .insert(sdkVersions)
      .values(
        releases.map((release, index) => ({
          game: 'bf6' as const,
          version: release.version,
          season: release.season,
          sortOrder: index + 1,
        })),
      )
      .returning()
    const sdkId = lookup(
      'the SDK release',
      sdkRows.map((row) => [row.version, row.id]),
    )

    // Tag groups, then Portal's tags and the ones an admin would add.
    const groupRows = await tx
      .insert(tagGroupsTable)
      .values(
        tagGroups.map((group, index) => ({
          game: group.game,
          name: group.name,
          slug: slugify(group.name),
          description: group.description,
          sortOrder: index,
          filter: group.filter,
          creatorSelectable: group.creatorSelectable,
          showOnCard: group.showOnCard,
        })),
      )
      .returning()
    const groupId = lookup(
      'the tag group',
      groupRows.map((row) => [`${row.game}/${row.name}`, row.id]),
    )
    const tagRows = await tx
      .insert(tags)
      .values([
        ...portalTags.bf2042.map((tag, index) => ({
          game: 'bf2042' as const,
          groupId: groupId(
            eraTagIds.includes(tag.id) ? 'bf2042/Era' : 'bf2042/Rules',
          ),
          name: tag.name,
          slug: slugify(tag.name),
          portalId: tag.id,
          portalName: tag.name,
          description: tag.description,
          sortOrder: index,
        })),
        ...portalTags.bf6.map((tag, index) => ({
          game: 'bf6' as const,
          groupId: groupId('bf6/Rules'),
          name: tag.name,
          slug: slugify(tag.name),
          portalId: tag.id,
          // Portal publishes no English name for some of these, and a guess
          // at one is not Portal's name.
          portalName: tag.nameFrom === 'ea' ? tag.name : null,
          sortOrder: index,
        })),
        ...tagGroups.flatMap((group) =>
          group.tags.map((name, index) => ({
            game: group.game,
            groupId: groupId(`${group.game}/${group.name}`),
            name,
            slug: slugify(name),
            sortOrder: index,
          })),
        ),
      ])
      .returning()
    const portalTagId = lookup(
      "Portal's tag",
      tagRows
        .filter((row) => row.portalId)
        .map((row) => [`${row.game}/${row.portalId}`, row.id]),
    )
    const namedTagId = lookup(
      'the tag',
      tagRows
        .filter((row) => !row.portalId)
        .map((row) => [`${row.game}/${row.name}`, row.id]),
    )
    await tx.insert(tagAliasesTable).values(
      tagAliases.map((alias) => ({
        game: alias.game,
        alias: alias.alias,
        tagId: portalTagId(`${alias.game}/${alias.portalId}`),
      })),
    )

    // Maps. A Battlefield 2042 map carries the tag of the era it came from.
    const mapRows = await tx
      .insert(maps)
      .values([
        ...bf6Maps.map((map, index) => ({
          game: 'bf6' as const,
          levelId: map.levelId,
          // A map can turn up in a rotation before Portal names it.
          name: map.name ?? map.levelId,
          imageUrl: map.image,
          requiresFullGame: map.requiresFullGame,
          sortOrder: index,
        })),
        ...bf2042Maps.map((map, index) => ({
          game: 'bf2042' as const,
          levelId: map.levelId,
          name: map.name,
          imageUrl: map.image,
          sortOrder: index,
        })),
      ])
      .returning()
    const mapOf = lookup(
      'the map',
      mapRows.map((row) => [`${row.game}/${row.levelId}`, row]),
    )
    const eraOfMap = new Map(
      bf2042Maps.map((map) => [
        mapOf(`bf2042/${map.levelId}`).id,
        portalTagId(`bf2042/${map.era}`),
      ]),
    )
    await tx
      .insert(mapTags)
      .values([...eraOfMap].map(([mapId, tagId]) => ({ mapId, tagId })))

    /**
     * Whether a rotation needs the paid game: one paid map is enough, and it
     * is free only when every map is known to be.
     */
    const needsFullGame = (game: Game, rotation: sample.Rotation = []) => {
      const known = rotation.map(
        (entry) => mapOf(`${game}/${entry.map}`).requiresFullGame,
      )
      if (known.includes(true)) return true
      return known.length > 0 && known.every((value) => value === false)
        ? false
        : null
    }

    // Experiences. Everything below hangs off this one insert helper.
    const usedSlugs = new Set<string>()
    const experienceIds = new Map<string, number>()
    let counter = 0

    async function addExperience(input: {
      values: typeof experiences.$inferInsert
      tagIds: { tagId: number; source: 'creator' | 'portal' }[]
      likes: number
      /** Likes land within this many days, so "this week" has something. */
      likedWithin: number
    }) {
      counter += 1
      const { values } = input
      usedSlugs.add(values.slug)
      const [row] = await tx.insert(experiences).values(values).returning()
      experienceIds.set(row.slug, row.id)

      const rotation = rotationSchema.parse(values.mapRotation ?? [])
      const fromMaps = rotation
        .map((entry) => eraOfMap.get(mapOf(`${row.game}/${entry.map}`).id))
        .filter((tagId) => tagId !== undefined)
      const tagged = [
        ...input.tagIds,
        ...fromMaps.map((tagId) => ({ tagId, source: 'map' as const })),
      ]
      if (tagged.length > 0) {
        await tx
          .insert(experienceTags)
          .values(tagged.map((tag) => ({ experienceId: row.id, ...tag })))
          // A tag the creator or Portal already gave it stays theirs.
          .onConflictDoNothing()
      }

      const likers = pick(input.likes, row.ownerId, counter)
      if (likers.length > 0) {
        await tx.insert(experienceLikes).values(
          likers.map((liker, index) => ({
            experienceId: row.id,
            userId: liker,
            createdAt: ago(
              (((index * 13 + counter * 5) % 97) / 97) * input.likedWithin,
            ),
          })),
        )
      }
      return row
    }

    // The real ones, as Portal's website and gametools described them.
    const byLikes = [...bf6.experiences].sort((a, b) => b.likes - a.likes)
    const trending = new Set(byLikes.slice(0, 6).map((e) => e.code))
    for (const real of bf6.experiences) {
      const base = slugify(real.title)
      const slug = usedSlugs.has(base) || !base ? `${base}-${real.code}` : base
      await addExperience({
        values: {
          slug,
          game: 'bf6',
          status: 'published',
          title: real.title,
          descriptionMd: real.description,
          descriptionHtml: textToHtml(real.description),
          ownerId: userId(slugify(real.creator.name)),
          categoryId: categoryId('Multiplayer'),
          code: real.code,
          playgroundId: real.playgroundId,
          coverImgUrl: real.thumbnailUrl,
          maxPlayers: real.players,
          types: typesOf(real),
          gameMode: real.rotation[0]?.mode,
          mapRotation: real.rotation,
          xpMode: real.xpMode,
          // EA's website says so directly for each of these.
          requiresFullGame: real.premium,
          featured: real.creator.kind === 'trusted',
          trending: trending.has(real.code),
          portalState: 'published',
          portalCheckedAt: ago(0.25),
          portalStateSince: real.created,
          submittedAt: real.created,
          firstPublishedAt: real.created,
          lastPublishedAt: real.updated,
          announcedAt: real.created,
          reviewedBy: moderator,
          reviewedAt: real.created,
        },
        tagIds: real.tags.map((id) => ({
          tagId: portalTagId(`bf6/${id}`),
          source: 'portal' as const,
        })),
        // Portal counts likes in the tens of thousands. Here a like is a row
        // from a seed account, so the counts are squeezed onto a log scale.
        likes: Math.round(8 * Math.log10(real.likes + 1)),
        likedWithin: trending.has(real.code) ? 7 : 60,
      })
    }

    // The made-up ones.
    for (const item of sample.experiences) {
      const game: Game = item.game
      const status = item.status ?? 'published'
      const published = status === 'published'
      const created = ago(item.age)
      const firstMap = item.rotation?.[0]
      const cover =
        item.cover !== undefined
          ? sample.stockCovers[item.cover]
          : firstMap && mapOf(`${game}/${firstMap.map}`).imageUrl
      const portalState =
        item.portalState ?? (published && item.code ? 'published' : 'unchecked')
      const row = await addExperience({
        values: {
          slug: item.slug,
          game,
          status,
          title: item.title,
          descriptionMd: item.description,
          descriptionHtml: textToHtml(item.description),
          ownerId: userId(item.owner),
          categoryId: categoryId(item.category),
          code: item.code,
          playgroundId: item.playgroundId,
          copyAllowed: item.copyAllowed,
          coverImgUrl: cover || null,
          repoUrl: item.repoUrl,
          filesUrl: item.filesUrl,
          maxPlayers: item.players,
          maxBots: item.bots ?? 0,
          types: item.types ?? [],
          isTemplate: item.isTemplate ?? false,
          gameMode: firstMap?.mode,
          mapRotation: item.rotation,
          xpMode: item.xpMode,
          requiresFullGame: needsFullGame(game, item.rotation),
          sdkVersionId: item.sdk ? sdkId(item.sdk) : null,
          featured: item.featured ?? false,
          trending: item.trending ?? false,
          bugged: item.bugged ?? false,
          portalState,
          portalCheckedAt: portalState === 'unchecked' ? null : ago(0.25),
          portalStateSince:
            portalState === 'unchecked'
              ? null
              : ago(item.portalStateAge ?? item.age),
          submittedAt: created,
          firstPublishedAt: published ? created : null,
          lastPublishedAt: published ? created : null,
          announcedAt: published ? created : null,
          reviewedBy: status === 'pending' ? null : moderator,
          reviewedAt: status === 'pending' ? null : created,
          reviewNote: item.reviewNote,
          deletedAt: item.deleted ? ago(1) : null,
        },
        tagIds: [
          ...[item.style, ...(item.topics ?? [])]
            .filter((name) => name !== undefined)
            .map((name) => ({
              tagId: namedTagId(`${game}/${name}`),
              source: 'creator' as const,
            })),
          ...(item.portalTags ?? []).map((id) => ({
            tagId: portalTagId(`${game}/${id}`),
            source: 'portal' as const,
          })),
        ],
        likes: item.likes,
        likedWithin: item.trending ? 7 : Math.min(item.age, 60),
      })

      if (item.gallery) {
        await tx.insert(experienceImages).values(
          item.gallery.map((cover, position) => ({
            experienceId: row.id,
            position,
            url: sample.stockCovers[cover],
          })),
        )
      }
      if (item.creators) {
        await tx.insert(experienceCreators).values(
          item.creators.map((creator, position) =>
            'user' in creator
              ? {
                  experienceId: row.id,
                  userId: userId(creator.user),
                  position,
                  canEdit: creator.canEdit ?? false,
                  // An invitation not yet accepted shows nowhere.
                  acceptedAt: creator.invited ? null : created,
                }
              : { experienceId: row.id, name: creator.name, position },
          ),
        )
      }
      for (const [type, count] of Object.entries(item.reports ?? {})) {
        await tx.insert(experienceReports).values(
          pick(count, row.ownerId, row.id + type.length).map((reporter) => ({
            experienceId: row.id,
            userId: reporter,
            type: type as keyof NonNullable<typeof item.reports>,
            createdAt: ago(0.1),
          })),
        )
      }
    }
    const experienceId = lookup('the experience', experienceIds)

    await tx.insert(revisions).values({
      experienceId: experienceId(sample.pendingEdit.experience),
      kind: 'edit',
      payload: sample.pendingEdit.payload,
      submittedBy: userId(sample.pendingEdit.by),
      submittedAt: ago(sample.pendingEdit.age),
    })
    await tx.insert(projectFiles).values({
      experienceId: experienceId(sample.sharedFile.experience),
      kind: 'script',
      filename: sample.sharedFile.filename,
      sizeBytes: Buffer.byteLength(sample.sharedFile.body),
      sha256: createHash('sha256').update(sample.sharedFile.body).digest('hex'),
      body: sample.sharedFile.body,
      fromExport: true,
      uploadedBy: userId('matavatar'),
    })

    // Scripts.
    const snippetRows = await tx
      .insert(snippets)
      .values(
        sample.snippets.map((snippet) => ({
          slug: snippet.slug,
          status: 'published' as const,
          title: snippet.title,
          descriptionMd: snippet.description,
          descriptionHtml: textToHtml(snippet.description),
          ownerId: userId(snippet.owner),
          categoryId: categoryId(snippet.category),
          script: snippet.script,
          repoUrl: snippet.repoUrl,
          sdkVersionId: sdkId(snippet.sdk),
          featured: snippet.featured,
          submittedAt: ago(snippet.age),
          firstPublishedAt: ago(snippet.age),
          lastPublishedAt: ago(snippet.age),
        })),
      )
      .returning()
    const snippetId = lookup(
      'the script',
      snippetRows.map((row) => [row.slug, row.id]),
    )
    for (const [index, snippet] of sample.snippets.entries()) {
      const row = snippetRows[index]
      await tx.insert(snippetLikes).values(
        pick(snippet.likes, row.ownerId, index + 3).map((liker) => ({
          snippetId: row.id,
          userId: liker,
        })),
      )
    }

    // Update posts.
    const updateRows = await tx
      .insert(updates)
      .values(
        sample.updates.map((update) => {
          const published = (update.status ?? 'published') === 'published'
          return {
            experienceId: update.experience
              ? experienceId(update.experience)
              : null,
            snippetId: update.snippet ? snippetId(update.snippet) : null,
            authorId: userId(update.author),
            title: update.title,
            bodyMd: update.body,
            bodyHtml: textToHtml(update.body),
            status: update.status ?? ('published' as const),
            publishedAt: published ? ago(update.age) : null,
            reviewedBy: published ? moderator : null,
            reviewedAt: published ? ago(update.age) : null,
            createdAt: ago(update.age),
          }
        }),
      )
      .returning()
    const updateId = lookup(
      'the update post',
      updateRows.map((row) => [row.title, row.id]),
    )

    // Playtests.
    await tx.insert(playtests).values(
      sample.playtests.map((playtest) => {
        const approved = playtest.status === 'approved'
        const opensAt = ago(playtest.opened)
        return {
          experienceId: playtest.experience
            ? experienceId(playtest.experience)
            : null,
          title: playtest.title,
          game: playtest.game,
          code: playtest.code,
          summary: playtest.summary,
          briefMd: playtest.brief,
          briefHtml: textToHtml(playtest.brief),
          hostId: userId(playtest.host),
          regions: playtest.regions,
          opensAt,
          closesAt: playtest.closesIn === null ? null : ago(-playtest.closesIn),
          status: playtest.status,
          reviewedBy: approved ? moderator : null,
          reviewedAt: approved ? opensAt : null,
          announcedAt: approved ? opensAt : null,
          // A made-up thread. Nothing is posted to Discord by the seed.
          discordUrl: approved
            ? `https://discord.com/channels/0/0/${playtest.code}`
            : null,
          resultUpdateId: playtest.resultUpdate
            ? updateId(playtest.resultUpdate)
            : null,
          createdAt: opensAt,
        }
      }),
    )

    // Events, and the banner for the one that is under way.
    const eventRows = await tx
      .insert(events)
      .values(
        sample.events.map((event) => {
          const startsAt = ago(-event.startsIn)
          return {
            slug: event.slug,
            title: event.title,
            summary: event.summary,
            startsAt,
            endsAt: new Date(startsAt.getTime() + event.hours * 60 * 60 * 1000),
            capacity: event.capacity,
            hostId: userId(event.host),
            published: true,
          }
        }),
      )
      .returning()
    for (const [index, event] of sample.events.entries()) {
      const row = eventRows[index]
      await tx.insert(eventInterest).values(
        pick(event.interested, row.hostId, index + 11).map((person) => ({
          eventId: row.id,
          userId: person,
        })),
      )
    }
    const live = eventRows.find((row) => row.slug === sample.banner.event)
    if (!live) {
      throw new Error(
        `The banner's event "${sample.banner.event}" is not there`,
      )
    }
    await tx.insert(banners).values({
      label: sample.banner.label,
      message: sample.banner.message,
      linkLabel: sample.banner.linkLabel,
      linkUrl: `/events#${live.slug}`,
      placement: 'home',
      startsAt: live.startsAt,
      endsAt: live.endsAt,
      eventId: live.id,
      createdBy: userId(sample.banner.by),
    })

    await tx.insert(siteSettings).values({})

    return {
      users: people.length,
      experiences: experienceIds.size,
      tags: tagRows.length,
      maps: mapRows.length,
      scripts: snippetRows.length,
      updates: updateRows.length,
      playtests: sample.playtests.length,
      events: eventRows.length,
    }
  })
}
