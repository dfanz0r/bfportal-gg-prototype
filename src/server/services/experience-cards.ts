import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

import { db } from '../db'
import {
  categories,
  experienceLikes,
  experiences,
  experienceTags,
  projectFiles,
  tagGroups,
  tags,
  user,
} from '../db/schema'
import { excerpt, groupBy, personColumns, publicPerson } from './shared'

// The card an experience is shown as in any listing, and the two conditions
// every public listing starts from.

/** What anyone may see: approved, and not deleted by its owner. */
export const visible = and(
  eq(experiences.status, 'published'),
  isNull(experiences.deletedAt),
)

/** Portal has the code, and nobody has marked it as not loading. */
const loads = and(
  eq(experiences.broken, false),
  notInArray(experiences.portalState, ['missing', 'unpublished']),
)

/** A template with something to take: shared files, or a link to them. */
const hasFiles = and(
  eq(experiences.isTemplate, true),
  or(
    isNotNull(experiences.filesUrl),
    sql`exists (select 1 from ${projectFiles} where ${projectFiles.experienceId} = ${experiences.id})`,
  ),
)

/**
 * Still of use as far as the site knows. That is an experience that loads, or
 * a template whose files can be taken even though its code has gone: the
 * files are the point of a template. Listings leave the rest out unless asked.
 */
export const available = or(loads, hasFiles)

export const likes = sql<number>`(select count(*)::int from ${experienceLikes} where ${experienceLikes.experienceId} = ${experiences.id})`

/** Likes since a moment, for "trending". */
export const likesSince = (since: Date) =>
  // As text with a cast: a Date in a raw SQL fragment has no column to say
  // how it should be sent.
  sql<number>`(select count(*)::int from ${experienceLikes} where ${experienceLikes.experienceId} = ${experiences.id} and ${experienceLikes.createdAt} >= ${since.toISOString()}::timestamptz)`

/**
 * Experiences as cards. `where` and `orderBy` may use the experiences, user
 * (the owner) and categories tables.
 */
export async function listCards(options: {
  where: SQL | undefined
  orderBy: SQL[]
  limit: number
}) {
  const rows = await db
    .select({
      id: experiences.id,
      game: experiences.game,
      slug: experiences.slug,
      title: experiences.title,
      descriptionMd: experiences.descriptionMd,
      coverImgUrl: experiences.coverImgUrl,
      category: categories.name,
      maxPlayers: experiences.maxPlayers,
      maxBots: experiences.maxBots,
      types: experiences.types,
      isTemplate: experiences.isTemplate,
      code: experiences.code,
      featured: experiences.featured,
      bugged: experiences.bugged,
      broken: experiences.broken,
      portalState: experiences.portalState,
      requiresFullGame: experiences.requiresFullGame,
      owner: personColumns,
      likes,
    })
    .from(experiences)
    .innerJoin(user, eq(user.id, experiences.ownerId))
    .innerJoin(categories, eq(categories.id, experiences.categoryId))
    .where(options.where)
    .orderBy(...options.orderBy)
    .limit(options.limit)

  // The tags a card shows: those from groups marked for it, a few at most.
  const cardTags =
    rows.length === 0
      ? []
      : await db
          .select({
            experienceId: experienceTags.experienceId,
            name: tags.name,
            slug: tags.slug,
          })
          .from(experienceTags)
          .innerJoin(tags, eq(tags.id, experienceTags.tagId))
          .innerJoin(tagGroups, eq(tagGroups.id, tags.groupId))
          .where(
            and(
              inArray(
                experienceTags.experienceId,
                rows.map((row) => row.id),
              ),
              eq(tagGroups.showOnCard, true),
              eq(tags.visible, true),
            ),
          )
          .orderBy(asc(tagGroups.sortOrder), asc(tags.sortOrder))
  const tagsOf = groupBy(cardTags, (tag) => tag.experienceId)

  return rows.map((row) => ({
    id: row.id,
    game: row.game,
    slug: row.slug,
    title: row.title,
    excerpt: excerpt(row.descriptionMd),
    coverImgUrl: row.coverImgUrl,
    category: row.category,
    maxPlayers: row.maxPlayers,
    maxBots: row.maxBots,
    types: row.types,
    isTemplate: row.isTemplate,
    code: row.code,
    likes: row.likes,
    featured: row.featured,
    bugged: row.bugged,
    unavailable: isUnavailable(row),
    requiresFullGame: row.requiresFullGame,
    // Someone who hides their name is not named on a card either.
    owner: publicPerson(row.owner),
    tags: (tagsOf.get(row.id) ?? [])
      .slice(0, 2)
      .map((tag) => ({ name: tag.name, slug: tag.slug })),
  }))
}

/** The other side of `available`, for one row already read. */
export function isUnavailable(row: {
  broken: boolean
  portalState: (typeof experiences.$inferSelect)['portalState']
}) {
  return (
    row.broken ||
    row.portalState === 'missing' ||
    row.portalState === 'unpublished'
  )
}

export type ExperienceCardData = Awaited<ReturnType<typeof listCards>>[number]
