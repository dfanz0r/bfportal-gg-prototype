import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  max,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { ExperienceType, Game } from '../../shared/content'
import { gameInfo, gameList } from '../../shared/games'
import {
  type LibrarySearch,
  type LibrarySort,
  PAGE_SIZE,
  playerRanges,
} from '../../shared/library-search'

import { db } from '../db'
import {
  categories,
  experienceCreators,
  experiences,
  experienceTags,
  tagAliases,
  tagGroups,
  tags,
  user,
} from '../db/schema'
import {
  available,
  likes,
  likesSince,
  listCards,
  visible,
} from './experience-cards'
import { groupBy } from './shared'

/** The user table a second time, for the accounts credited on an experience. */
const credited = alias(user, 'credited')

// What the Library page shows: one game's experiences, filtered and sorted,
// with what the filters need to draw themselves.

const DAY = 24 * 60 * 60 * 1000

/** The tags an address names, by slug, old name or alias, grouped. */
async function resolveTags(game: Game, names: string[]) {
  if (names.length === 0) return []
  const bySlugOrName = await db
    .select({ id: tags.id, slug: tags.slug, groupId: tags.groupId })
    .from(tags)
    .where(
      and(
        eq(tags.game, game),
        // The old site's links carry a tag's name: "?tag=VEHICLE MODIFIERS".
        or(inArray(tags.slug, names), inArray(sql`lower(${tags.name})`, names)),
      ),
    )
  const byAlias = await db
    .select({ id: tags.id, slug: tags.slug, groupId: tags.groupId })
    .from(tagAliases)
    .innerJoin(tags, eq(tags.id, tagAliases.tagId))
    .where(and(eq(tagAliases.game, game), inArray(tagAliases.alias, names)))
  const found = new Map(
    [...bySlugOrName, ...byAlias].map((tag) => [tag.id, tag]),
  )
  return [...found.values()]
}

export async function getLibrary(
  game: Game,
  search: LibrarySearch,
  now = new Date(),
) {
  const info = gameInfo(game)
  const weekAgo = new Date(now.getTime() - 7 * DAY)
  const inGame = and(eq(experiences.game, game), visible)

  const [categoryRows, groupRows, chosenTags] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        count: count(experiences.id),
      })
      .from(categories)
      .leftJoin(
        experiences,
        and(eq(experiences.categoryId, categories.id), inGame, available),
      )
      .where(
        and(
          eq(categories.kind, 'experience_main'),
          eq(categories.visible, true),
          or(isNull(categories.game), eq(categories.game, game)),
        ),
      )
      .groupBy(categories.id)
      .orderBy(asc(categories.sortOrder)),
    db
      .select({
        group: tagGroups.name,
        groupSlug: tagGroups.slug,
        filter: tagGroups.filter,
        name: tags.name,
        slug: tags.slug,
      })
      .from(tags)
      .innerJoin(tagGroups, eq(tagGroups.id, tags.groupId))
      .where(
        and(
          eq(tags.game, game),
          eq(tags.visible, true),
          ne(tagGroups.filter, 'none'),
        ),
      )
      .orderBy(asc(tagGroups.sortOrder), asc(tags.sortOrder), asc(tags.name)),
    resolveTags(game, search.tag ?? []),
  ])

  // Filters. One the game does not have is ignored, so a link survives a
  // change of tab.
  const category = categoryRows.find((row) => row.slug === search.category)
  const built = info.builtWith.length > 0 ? (search.built ?? []) : []
  const filters: (SQL | undefined)[] = [inGame]
  if (!search.unavailable) filters.push(available)
  if (category) filters.push(eq(experiences.categoryId, category.id))
  if (search.q) {
    const pattern = `%${search.q.replace(/[\\%_]/g, '\\$&')}%`
    filters.push(
      or(
        ilike(experiences.title, pattern),
        eq(experiences.code, search.q.toLowerCase()),
        and(eq(user.hideUsername, false), ilike(user.name, pattern)),
        // Anyone credited on it: a name, or an account that has accepted and
        // does not hide its name.
        exists(
          db
            .select({ one: sql`1` })
            .from(experienceCreators)
            .leftJoin(credited, eq(credited.id, experienceCreators.userId))
            .where(
              and(
                eq(experienceCreators.experienceId, experiences.id),
                or(
                  ilike(experienceCreators.name, pattern),
                  and(
                    isNotNull(experienceCreators.acceptedAt),
                    eq(credited.hideUsername, false),
                    ilike(credited.name, pattern),
                  ),
                ),
              ),
            ),
        ),
      ),
    )
  }
  // Within a group any of the chosen tags will do; across groups all must
  // hold. "BC2 or BF3" and "no vehicles".
  const byGroup = groupBy(chosenTags, (tag) => tag.groupId)
  for (const group of byGroup.values()) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(experienceTags)
          .where(
            and(
              eq(experienceTags.experienceId, experiences.id),
              inArray(
                experienceTags.tagId,
                group.map((tag) => tag.id),
              ),
            ),
          ),
      ),
    )
  }
  if (built.length > 0) {
    filters.push(
      sql`${experiences.types} @> ${`{${built.join(',')}}`}::experience_type[]`,
    )
  }
  if (search.players) {
    const range = playerRanges[search.players]
    filters.push(gte(experiences.maxPlayers, range.min))
    if (range.max !== null) filters.push(lte(experiences.maxPlayers, range.max))
  }
  if (search.featured) filters.push(eq(experiences.featured, true))
  if (search.templates) filters.push(eq(experiences.isTemplate, true))
  if (search.free && info.hasFreeVersion) {
    filters.push(eq(experiences.requiresFullGame, false))
  }
  if (search.xp) filters.push(eq(experiences.xpMode, 'portal-default'))
  const where = and(...filters)

  const sort: LibrarySort = search.sort ?? info.library.sort
  const recentLikes = likesSince(weekAgo)
  const newest = desc(experiences.firstPublishedAt)
  const order = {
    trending: [desc(recentLikes), desc(likes), newest],
    likes: [desc(likes), newest],
    newest: [newest],
  }[sort]
  const page = search.page ?? 1

  const [items, [matching], tabs, [stats]] = await Promise.all([
    // "Show more" grows the page, so page two holds the first two pages.
    listCards({
      where,
      orderBy: [...order, desc(experiences.id)],
      limit: page * PAGE_SIZE,
    }),
    db
      .select({ value: count() })
      .from(experiences)
      .innerJoin(user, eq(user.id, experiences.ownerId))
      .where(where),
    db
      .select({ game: experiences.game, value: count() })
      .from(experiences)
      .where(and(visible, available))
      .groupBy(experiences.game),
    // What the head of the page says. Everything is counted among those that
    // still load, but for `listed`: how many there are whether they load or
    // not, which a library that leads with its health sets the count against.
    db
      .select({
        experiences: count(sql`case when ${available} then 1 end`),
        newThisWeek: count(
          sql`case when ${available} and ${experiences.firstPublishedAt} >= ${weekAgo.toISOString()}::timestamptz then 1 end`,
        ),
        creators: countDistinct(
          sql`case when ${available} then ${experiences.ownerId} end`,
        ),
        listed: count(),
        // When the nightly check last looked at any of them.
        checkedAt: max(experiences.portalCheckedAt),
      })
      .from(experiences)
      .where(inGame),
  ])

  const groups = [...groupBy(groupRows, (row) => row.groupSlug).values()]
  const chosenSlugs = chosenTags.map((tag) => tag.slug)

  return {
    game,
    // What was asked for, as understood: unknown values gone, tags by their
    // own slugs whatever name the address used.
    search: {
      ...search,
      category: category?.slug,
      tag: chosenSlugs.length > 0 ? chosenSlugs : undefined,
      built: built.length > 0 ? (built as ExperienceType[]) : undefined,
      free: info.hasFreeVersion ? search.free : undefined,
      sort,
      page,
    },
    total: matching.value,
    items,
    games: gameList.map((entry) => ({
      id: entry.id,
      name: entry.name,
      path: entry.libraryPath,
      count: tabs.find((tab) => tab.game === entry.id)?.value ?? 0,
    })),
    categories: categoryRows.map((row) => ({
      name: row.name,
      slug: row.slug,
      count: row.count,
    })),
    tagGroups: groups.map((group) => ({
      name: group[0].group,
      slug: group[0].groupSlug,
      own: group[0].filter === 'own',
      tags: group.map((tag) => ({ name: tag.name, slug: tag.slug })),
    })),
    stats,
    // When this was read, for "checked 6 hours ago".
    now,
  }
}

export type LibraryData = Awaited<ReturnType<typeof getLibrary>>
