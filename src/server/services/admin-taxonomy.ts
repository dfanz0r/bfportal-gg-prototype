import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'

import type { Game, TagGroupFilter, TagGroupPick } from '../../shared/content'
import { gameInfo } from '../../shared/games'
import { type Refusal, refuse } from '../../shared/results'
import { slugify } from '../../shared/slug'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  experiences,
  experienceTags,
  snippets,
  tagGroups,
  tags,
} from '../db/schema'
import { needsAdmin } from './access'
import { type Executor, outer, violates } from './shared'

// Each game's categories, tag groups and tags, for the admins: what differs
// by game is data, not code, and this is where it is changed. Nothing is
// deleted here, since experiences point at these: one no longer wanted is
// hidden. An address, once given, stays, so links to it keep working.

const usedByExperiences = sql<number>`(select count(*)::int from ${experiences} where ${experiences.categoryId} = ${outer(categories.id)} and ${experiences.deletedAt} is null)`
const usedBySnippets = sql<number>`(select count(*)::int from ${snippets} where ${snippets.categoryId} = ${outer(categories.id)} and ${snippets.deletedAt} is null)`
const taggedCount = sql<number>`(select count(*)::int from ${experienceTags} where ${experienceTags.tagId} = ${outer(tags.id)})`

/**
 * A game's categories, and the snippet categories when the game has
 * snippets, and its tag groups with their tags, each in order and with how
 * much uses it.
 */
export async function getTaxonomy(actor: Actor | null, game: Game) {
  const refused = needsAdmin(actor)
  if (refused) return refused
  const [experienceCategories, snippetCategories, groups, tagRows] =
    await Promise.all([
      db
        .select({
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
          game: categories.game,
          visible: categories.visible,
          selectableOnForm: categories.selectableOnForm,
          marksTemplate: categories.marksTemplate,
          used: usedByExperiences,
        })
        .from(categories)
        .where(
          and(
            eq(categories.kind, 'experience_main'),
            or(isNull(categories.game), eq(categories.game, game)),
          ),
        )
        .orderBy(asc(categories.sortOrder), asc(categories.id)),
      gameInfo(game).snippets === true
        ? db
            .select({
              id: categories.id,
              name: categories.name,
              slug: categories.slug,
              game: categories.game,
              visible: categories.visible,
              selectableOnForm: categories.selectableOnForm,
              marksTemplate: categories.marksTemplate,
              used: usedBySnippets,
            })
            .from(categories)
            .where(eq(categories.kind, 'script_main'))
            .orderBy(asc(categories.sortOrder), asc(categories.id))
        : [],
      db
        .select({
          id: tagGroups.id,
          name: tagGroups.name,
          slug: tagGroups.slug,
          description: tagGroups.description,
          filter: tagGroups.filter,
          pick: tagGroups.pick,
          creatorSelectable: tagGroups.creatorSelectable,
          showOnCard: tagGroups.showOnCard,
        })
        .from(tagGroups)
        .where(eq(tagGroups.game, game))
        .orderBy(asc(tagGroups.sortOrder), asc(tagGroups.id)),
      db
        .select({
          id: tags.id,
          groupId: tags.groupId,
          name: tags.name,
          slug: tags.slug,
          portalId: tags.portalId,
          visible: tags.visible,
          used: taggedCount,
        })
        .from(tags)
        .where(eq(tags.game, game))
        .orderBy(asc(tags.sortOrder), asc(tags.name)),
    ])
  return {
    ok: true as const,
    game,
    experienceCategories,
    snippetCategories,
    groups: groups.map((group) => ({
      ...group,
      tags: tagRows.filter((tag) => tag.groupId === group.id),
    })),
  }
}

/** The answer to a name some other row of the same list already has. */
const taken = (what: string) =>
  refuse('invalid', { name: `There is already a ${what} with that name.` })

/** The next place at the end of a list. */
async function lastPlace(
  executor: Executor,
  table: typeof categories | typeof tagGroups | typeof tags,
  where: ReturnType<typeof and>,
) {
  const [{ value }] = await executor
    .select({
      value: sql<number>`coalesce(max(${table.sortOrder}), 0)`.mapWith(Number),
    })
    .from(table)
    .where(where)
  return value + 1
}

/** What an admin may set on a category. */
export type CategoryChange = {
  name: string
  visible: boolean
  selectableOnForm: boolean
  marksTemplate: boolean
}

/**
 * Adds a category, for one game or for every game, of experiences or of
 * snippets; or changes one. Its address comes from its first name and stays.
 */
export async function saveCategory(
  actor: Actor | null,
  target:
    | { id: number }
    | { kind: 'experience_main' | 'script_main'; game: Game | null },
  change: CategoryChange,
): Promise<{ ok: true } | Refusal> {
  const refused = needsAdmin(actor)
  if (refused) return refused
  const name = change.name.trim()
  if (name.length < 2) return refuse('invalid', { name: 'Give it a name.' })
  try {
    if ('id' in target) {
      const [changed] = await db
        .update(categories)
        .set({ ...change, name })
        .where(eq(categories.id, target.id))
        .returning({ id: categories.id })
      return changed ? { ok: true } : refuse('not-found')
    }
    const slug = slugify(name)
    if (!slug) return refuse('invalid', { name: 'Give it a name in letters.' })
    await db.insert(categories).values({
      ...change,
      name,
      slug,
      kind: target.kind,
      game: target.game,
      sortOrder: await lastPlace(
        db,
        categories,
        eq(categories.kind, target.kind),
      ),
    })
    return { ok: true }
  } catch (error) {
    if (
      violates(error, 'categories_kind_name_unique') ||
      violates(error, 'categories_kind_slug_unique')
    ) {
      return taken('category')
    }
    throw error
  }
}

/** What an admin may set on a tag group. */
export type TagGroupChange = {
  name: string
  description: string
  filter: TagGroupFilter
  pick: TagGroupPick
  creatorSelectable: boolean
  showOnCard: boolean
}

/** Adds a tag group to a game, or changes one. Its address stays. */
export async function saveTagGroup(
  actor: Actor | null,
  target: { id: number } | { game: Game },
  change: TagGroupChange,
): Promise<{ ok: true } | Refusal> {
  const refused = needsAdmin(actor)
  if (refused) return refused
  const name = change.name.trim()
  if (name.length < 2) return refuse('invalid', { name: 'Give it a name.' })
  try {
    if ('id' in target) {
      const [changed] = await db
        .update(tagGroups)
        .set({ ...change, name })
        .where(eq(tagGroups.id, target.id))
        .returning({ id: tagGroups.id })
      return changed ? { ok: true } : refuse('not-found')
    }
    const slug = slugify(name)
    if (!slug) return refuse('invalid', { name: 'Give it a name in letters.' })
    await db.insert(tagGroups).values({
      ...change,
      name,
      slug,
      game: target.game,
      sortOrder: await lastPlace(
        db,
        tagGroups,
        eq(tagGroups.game, target.game),
      ),
    })
    return { ok: true }
  } catch (error) {
    if (
      violates(error, 'tag_groups_game_name_unique') ||
      violates(error, 'tag_groups_game_slug_unique')
    ) {
      return taken('tag group')
    }
    throw error
  }
}

/** What an admin may set on a tag. */
export type TagChange = { name: string; visible: boolean; groupId: number }

/**
 * Adds a tag to one of a game's groups, or changes one, its group included.
 * Its address stays. A group must be the tag's own game's.
 */
export async function saveTag(
  actor: Actor | null,
  target: { id: number } | { game: Game },
  change: TagChange,
): Promise<{ ok: true } | Refusal> {
  const refused = needsAdmin(actor)
  if (refused) return refused
  const name = change.name.trim()
  if (name.length < 2) return refuse('invalid', { name: 'Give it a name.' })
  const game =
    'game' in target
      ? target.game
      : (
          await db
            .select({ game: tags.game })
            .from(tags)
            .where(eq(tags.id, target.id))
        )[0]?.game
  if (!game) return refuse('not-found')
  const [group] = await db
    .select({ id: tagGroups.id })
    .from(tagGroups)
    .where(and(eq(tagGroups.id, change.groupId), eq(tagGroups.game, game)))
  if (!group) {
    return refuse('invalid', { groupId: 'Choose one of this game’s groups.' })
  }
  try {
    if ('id' in target) {
      await db
        .update(tags)
        .set({ ...change, name })
        .where(eq(tags.id, target.id))
      return { ok: true }
    }
    const slug = slugify(name)
    if (!slug) return refuse('invalid', { name: 'Give it a name in letters.' })
    await db.insert(tags).values({
      ...change,
      name,
      slug,
      game,
      sortOrder: await lastPlace(db, tags, eq(tags.groupId, change.groupId)),
    })
    return { ok: true }
  } catch (error) {
    if (
      violates(error, 'tags_game_name_unique') ||
      violates(error, 'tags_game_slug_unique')
    ) {
      return taken('tag in this game')
    }
    throw error
  }
}

/** What can be moved up or down its list. */
export type Ordered = 'category' | 'tag-group' | 'tag'

/**
 * Moves a category, tag group or tag one place up or down its own list, the
 * order the site shows them in. A category moves within the list `game`
 * shows: its own categories and every game's.
 */
export async function moveInList(
  actor: Actor | null,
  what: Ordered,
  id: number,
  direction: 'up' | 'down',
  game?: Game,
): Promise<{ ok: true } | Refusal> {
  const refused = needsAdmin(actor)
  if (refused) return refused
  return db.transaction(async (tx) => {
    // One reorder at a time: two at once could leave two in one place.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('taxonomy-order', 0))`,
    )
    const list = await listOf(tx, what, id, game)
    if (!list) return refuse('not-found')
    const at = list.findIndex((row) => row.id === id)
    const to = direction === 'up' ? at - 1 : at + 1
    if (to < 0 || to >= list.length) return { ok: true as const }
    // The rows take the places the list already holds, in their new order,
    // so a list that shares its numbering with another, as one game's
    // categories do with every game's, keeps its place among them. Places
    // that were the same, as the reference rows' can be, are spread apart
    // first, or the move would not show.
    const places: number[] = []
    for (const [index, row] of list.entries()) {
      places.push(
        index === 0 ? row.place : Math.max(row.place, places[index - 1] + 1),
      )
    }
    const moved = [...list]
    ;[moved[at], moved[to]] = [moved[to], moved[at]]
    const table =
      what === 'category' ? categories : what === 'tag-group' ? tagGroups : tags
    for (const [index, row] of moved.entries()) {
      if (row.place === places[index]) continue
      await tx
        .update(table)
        .set({ sortOrder: places[index] })
        .where(eq(table.id, row.id))
    }
    return { ok: true as const }
  })
}

/** The list a row is ordered within, in its order now. */
async function listOf(tx: Executor, what: Ordered, id: number, game?: Game) {
  if (what === 'category') {
    const [row] = await tx
      .select({ kind: categories.kind })
      .from(categories)
      .where(eq(categories.id, id))
    if (!row) return null
    return tx
      .select({ id: categories.id, place: categories.sortOrder })
      .from(categories)
      .where(
        and(
          eq(categories.kind, row.kind),
          game
            ? or(isNull(categories.game), eq(categories.game, game))
            : undefined,
        ),
      )
      .orderBy(asc(categories.sortOrder), asc(categories.id))
  }
  if (what === 'tag-group') {
    const [row] = await tx
      .select({ game: tagGroups.game })
      .from(tagGroups)
      .where(eq(tagGroups.id, id))
    if (!row) return null
    return tx
      .select({ id: tagGroups.id, place: tagGroups.sortOrder })
      .from(tagGroups)
      .where(eq(tagGroups.game, row.game))
      .orderBy(asc(tagGroups.sortOrder), asc(tagGroups.id))
  }
  const [row] = await tx
    .select({ groupId: tags.groupId })
    .from(tags)
    .where(eq(tags.id, id))
  if (!row) return null
  return tx
    .select({ id: tags.id, place: tags.sortOrder })
    .from(tags)
    .where(eq(tags.groupId, row.groupId))
    .orderBy(asc(tags.sortOrder), asc(tags.name))
}
