import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  ne,
  or,
  type SQL,
  sql,
} from 'drizzle-orm'

import {
  ADMIN_PAGE,
  type AdminSort,
  type AdminStatus,
  adminStatuses,
  type HealthFlag,
} from '../../shared/admin-search'
import type { ContentStatus, Game } from '../../shared/content'
import { type Refusal, refuse } from '../../shared/results'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  experienceReports,
  experiences,
  snippetLikes,
  snippets,
  user,
} from '../db/schema'
import { needsAdmin, needsStaff } from './access'
import { isUnavailable, likes } from './experience-cards'
import { outer } from './shared'

// Every experience and snippet, whatever its state, for the moderators: to
// find one, see where it stands, delist it or list it again. Featured and
// trending are the admins' to set.

const openReports = sql<number>`(select count(*)::int from ${experienceReports} where ${experienceReports.experienceId} = ${outer(experiences.id)} and ${experienceReports.resolvedAt} is null)`

const flagged: Record<HealthFlag, SQL> = {
  bugged: eq(experiences.bugged, true),
  broken: eq(experiences.broken, true),
  xp_farm: eq(experiences.xpFarm, true),
  unavailable: sql`(${experiences.broken} or ${experiences.portalState} in ('missing', 'unpublished'))`,
}

/**
 * Every experience but drafts and those deleted, newest first or as sorted,
 * filtered by state, game, health flag, the admin switches, reports and a
 * search of title, code and owner.
 */
export async function listAdminExperiences(
  actor: Actor | null,
  options: {
    status?: AdminStatus
    game?: Game
    q?: string
    flag?: HealthFlag
    featured?: boolean
    trending?: boolean
    reported?: boolean
    sort?: AdminSort
    page?: number
  } = {},
) {
  const refused = needsStaff(actor)
  if (refused) return refused
  const page = options.page ?? 1
  const q = options.q?.trim()
  const chosen = and(
    isNull(experiences.deletedAt),
    ne(experiences.status, 'draft'),
    options.game ? eq(experiences.game, options.game) : undefined,
    options.flag ? flagged[options.flag] : undefined,
    options.featured ? eq(experiences.featured, true) : undefined,
    options.trending ? eq(experiences.trending, true) : undefined,
    options.reported ? sql`${openReports} > 0` : undefined,
    q
      ? or(
          ilike(experiences.title, `%${q}%`),
          ilike(experiences.code, `%${q}%`),
          ilike(user.name, `%${q}%`),
        )
      : undefined,
  )
  const where = and(
    chosen,
    options.status ? eq(experiences.status, options.status) : undefined,
  )
  const order =
    options.sort === 'likes'
      ? [desc(likes)]
      : options.sort === 'reports'
        ? [desc(openReports)]
        : []
  const [rows, [matching], counts] = await Promise.all([
    db
      .select({
        id: experiences.id,
        slug: experiences.slug,
        title: experiences.title,
        code: experiences.code,
        game: experiences.game,
        status: experiences.status,
        owner: user.name,
        likes,
        reports: openReports,
        featured: experiences.featured,
        trending: experiences.trending,
        bugged: experiences.bugged,
        broken: experiences.broken,
        xpFarm: experiences.xpFarm,
        portalState: experiences.portalState,
      })
      .from(experiences)
      .innerJoin(user, eq(user.id, experiences.ownerId))
      .where(where)
      .orderBy(...order, desc(experiences.submittedAt), desc(experiences.id))
      .limit(page * ADMIN_PAGE),
    db
      .select({ value: count() })
      .from(experiences)
      .innerJoin(user, eq(user.id, experiences.ownerId))
      .where(where),
    // The tabs count over everything else chosen, so each says what
    // pressing it would show.
    db
      .select({ status: experiences.status, value: count() })
      .from(experiences)
      .innerJoin(user, eq(user.id, experiences.ownerId))
      .where(chosen)
      .groupBy(experiences.status),
  ])
  return {
    ok: true as const,
    items: rows.map(({ bugged, broken, xpFarm, portalState, ...row }) => ({
      ...row,
      flags: {
        bugged,
        broken,
        xpFarm,
        unavailable: isUnavailable({ broken, portalState }),
      },
    })),
    total: matching.value,
    counts: tallied(counts),
    page,
  }
}

/** Counts by status as the tabs show them, from rows grouped by status. */
function tallied(rows: { status: ContentStatus; value: number }[]) {
  const of = (status: AdminStatus) =>
    rows.find((row) => row.status === status)?.value ?? 0
  const byStatus = Object.fromEntries(
    adminStatuses.map((status) => [status, of(status)]),
  ) as Record<AdminStatus, number>
  return {
    all: adminStatuses.reduce((sum, status) => sum + byStatus[status], 0),
    ...byStatus,
  }
}

const snippetLikeCount = sql<number>`(select count(*)::int from ${snippetLikes} where ${snippetLikes.snippetId} = ${snippets.id})`

/**
 * Every snippet but those deleted, newest first or most liked, by state and a
 * search of title and owner.
 */
export async function listAdminSnippets(
  actor: Actor | null,
  options: {
    status?: AdminStatus
    q?: string
    sort?: Exclude<AdminSort, 'reports'>
    page?: number
  } = {},
) {
  const refused = needsStaff(actor)
  if (refused) return refused
  const page = options.page ?? 1
  const q = options.q?.trim()
  const chosen = and(
    isNull(snippets.deletedAt),
    ne(snippets.status, 'draft'),
    q
      ? or(ilike(snippets.title, `%${q}%`), ilike(user.name, `%${q}%`))
      : undefined,
  )
  const where = and(
    chosen,
    options.status ? eq(snippets.status, options.status) : undefined,
  )
  const [rows, [matching], counts] = await Promise.all([
    db
      .select({
        id: snippets.id,
        slug: snippets.slug,
        title: snippets.title,
        category: categories.name,
        status: snippets.status,
        owner: user.name,
        likes: snippetLikeCount,
        featured: snippets.featured,
        trending: snippets.trending,
      })
      .from(snippets)
      .innerJoin(user, eq(user.id, snippets.ownerId))
      .leftJoin(categories, eq(categories.id, snippets.categoryId))
      .where(where)
      .orderBy(
        ...(options.sort === 'likes' ? [desc(snippetLikeCount)] : []),
        desc(snippets.submittedAt),
        desc(snippets.id),
      )
      .limit(page * ADMIN_PAGE),
    db
      .select({ value: count() })
      .from(snippets)
      .innerJoin(user, eq(user.id, snippets.ownerId))
      .where(where),
    db
      .select({ status: snippets.status, value: count() })
      .from(snippets)
      .innerJoin(user, eq(user.id, snippets.ownerId))
      .where(chosen)
      .groupBy(snippets.status),
  ])
  return {
    ok: true as const,
    items: rows,
    total: matching.value,
    counts: tallied(counts),
    page,
  }
}

/** What an admin list acts on: an experience or a snippet. */
export type ContentKind = 'experience' | 'snippet'
const tableOf = (kind: ContentKind) =>
  kind === 'experience' ? experiences : snippets

/**
 * Sets whether an experience or a snippet is featured, or trending. Only an
 * admin may, and it applies at once.
 */
export async function setSpotlight(
  actor: Actor | null,
  kind: ContentKind,
  slug: string,
  change: { featured?: boolean; trending?: boolean },
): Promise<{ ok: true } | Refusal> {
  const refused = needsAdmin(actor)
  if (refused) return refused
  if (change.featured === undefined && change.trending === undefined) {
    return refuse('invalid', { form: 'Say what to change.' })
  }
  const table = tableOf(kind)
  const [changed] = await db
    .update(table)
    .set(change)
    .where(and(eq(table.slug, slug), isNull(table.deletedAt)))
    .returning({ id: table.id })
  return changed ? { ok: true } : refuse('not-found')
}

/**
 * Takes something live off the listings, or lists it again. A moderator or an
 * admin may. Only one that is live can be delisted, and only one delisted can
 * be listed again: anything in review is decided in the queue.
 */
export async function setListed(
  actor: Actor | null,
  kind: ContentKind,
  slug: string,
  listed: boolean,
): Promise<{ ok: true } | Refusal> {
  const refused = needsStaff(actor)
  if (refused) return refused
  const table = tableOf(kind)
  const [changed] = await db
    .update(table)
    .set({ status: listed ? 'published' : 'unpublished' })
    .where(
      and(
        eq(table.slug, slug),
        eq(table.status, listed ? 'unpublished' : 'published'),
        isNull(table.deletedAt),
      ),
    )
    .returning({ id: table.id })
  return changed ? { ok: true } : refuse('not-found')
}
