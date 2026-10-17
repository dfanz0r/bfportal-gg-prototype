import { readFileSync } from 'node:fs'

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { z } from 'zod'

import * as schema from '../src/server/db/schema'
import { slugify } from '../src/shared/slug'
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

// The rows the site needs before it has any content: categories, SDK
// releases, tag groups and tags, and both games' maps. Every database needs
// them, a server's as well as a developer's, so this is apart from the sample
// content and safe to run anywhere: it only adds rows that are missing, by
// each table's own name for a row. It never deletes anything, and never
// changes a row that is there, so an admin's edits stand. `pnpm db:reference`
// runs it; the seed runs it too.

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

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

/** Portal's own tags, for both games, as read from Portal. */
const readPortalTags = () =>
  portalTagsSchema.parse(
    JSON.parse(
      readFileSync(new URL('./portal-tags.json', import.meta.url), 'utf8'),
    ),
  )

/** A lookup that names what is missing, so a typo in the data is findable. */
function lookup<T>(what: string, entries: Iterable<[string, T]>) {
  const map = new Map(entries)
  return (key: string) => {
    const value = map.get(key)
    if (value === undefined) {
      throw new Error(
        `Reference data refers to ${what} "${key}", which is not there`,
      )
    }
    return value
  }
}

/**
 * Adds whatever reference rows are missing, and returns all of them, those
 * that were there and those just added.
 */
export async function loadReference(db: Db) {
  const portalTags = readPortalTags()
  const {
    categories,
    sdkVersions,
    tagGroups: tagGroupsTable,
    tags,
    tagAliases: tagAliasesTable,
    maps,
    mapTags,
  } = schema

  await db
    .insert(categories)
    .values([
      ...experienceCategories.map((category, index) => ({
        kind: 'experience_main' as const,
        game: category.game,
        name: category.name,
        slug: slugify(category.name),
        marksTemplate: category.marksTemplate ?? false,
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
    .onConflictDoNothing()
  const categoryRows = await db.select().from(categories)

  const releases = sdkReleases.flatMap((release) =>
    release.versions.map((version) => ({ version, season: release.season })),
  )
  await db
    .insert(sdkVersions)
    .values(
      releases.map((release, index) => ({
        game: 'bf6' as const,
        version: release.version,
        season: release.season,
        sortOrder: index + 1,
      })),
    )
    .onConflictDoNothing()
  const sdkRows = await db.select().from(sdkVersions)

  await db
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
    .onConflictDoNothing()
  const groupRows = await db.select().from(tagGroupsTable)
  const groupId = lookup(
    'the tag group',
    groupRows.map((row) => [`${row.game}/${row.name}`, row.id]),
  )

  // Portal's tags, then the ones an admin would add.
  await db
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
        // Portal publishes no English name for some of these, and a guess at
        // one is not Portal's name.
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
    .onConflictDoNothing()
  const tagRows = await db.select().from(tags)
  const portalTagId = lookup(
    "Portal's tag",
    tagRows
      .filter((row) => row.portalId)
      .map((row) => [`${row.game}/${row.portalId}`, row.id]),
  )
  await db
    .insert(tagAliasesTable)
    .values(
      tagAliases.map((alias) => ({
        game: alias.game,
        alias: alias.alias,
        tagId: portalTagId(`${alias.game}/${alias.portalId}`),
      })),
    )
    .onConflictDoNothing()

  await db
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
    .onConflictDoNothing()
  const mapRows = await db.select().from(maps)
  const mapOf = lookup(
    'the map',
    mapRows.map((row) => [`${row.game}/${row.levelId}`, row]),
  )
  // A Battlefield 2042 map carries the tag of the era it came from.
  const eraOfMap = new Map(
    bf2042Maps.map((map) => [
      mapOf(`bf2042/${map.levelId}`).id,
      portalTagId(`bf2042/${map.era}`),
    ]),
  )
  await db
    .insert(mapTags)
    .values([...eraOfMap].map(([mapId, tagId]) => ({ mapId, tagId })))
    .onConflictDoNothing()

  return { categoryRows, sdkRows, groupRows, tagRows, mapRows, eraOfMap }
}
