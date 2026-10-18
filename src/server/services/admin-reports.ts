import { and, desc, eq, isNotNull, isNull, max, sql } from 'drizzle-orm'

import type { ReportSort, ReportState } from '../../shared/admin-search'
import type { Game, ReportType } from '../../shared/content'
import { type Refusal, refuse } from '../../shared/results'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experienceReports, experiences } from '../db/schema'
import { needsStaff } from './access'
import { isUnavailable } from './experience-cards'
import type { Executor } from './shared'

// What players have reported, for the moderators: each experience with its
// reports counted by kind. A report changes nothing by itself. A moderator
// dismisses them, or sets the experience's health flags, and either way they
// are dealt with until someone reports it again.

/** The most rows a list of reports shows. */
const SHOWN = 100

const counted = (type: ReportType) =>
  sql<number>`count(*) filter (where ${experienceReports.type} = ${type})`.mapWith(
    Number,
  )

/**
 * The reported experiences, with how many of each kind of report: those with
 * reports still open, or those whose reports were dealt with. With how many
 * there are of each, for the tabs.
 */
export async function listReports(
  actor: Actor | null,
  options: {
    state?: ReportState
    game?: Game
    kind?: ReportType
    sort?: ReportSort
  } = {},
) {
  const refused = needsStaff(actor)
  if (refused) return refused
  const state = options.state ?? 'open'
  const open = isNull(experienceReports.resolvedAt)
  const dealtWith = isNotNull(experienceReports.resolvedAt)
  const shown = and(
    state === 'open' ? open : dealtWith,
    isNull(experiences.deletedAt),
    options.game ? eq(experiences.game, options.game) : undefined,
  )
  const total = sql<number>`count(*)`.mapWith(Number)
  const last = max(
    state === 'open'
      ? experienceReports.createdAt
      : experienceReports.resolvedAt,
  )

  const tally = (where: ReturnType<typeof and>) =>
    db
      .select({
        value:
          sql<number>`count(distinct ${experienceReports.experienceId})`.mapWith(
            Number,
          ),
      })
      .from(experienceReports)
      .innerJoin(
        experiences,
        eq(experiences.id, experienceReports.experienceId),
      )
      .where(and(where, isNull(experiences.deletedAt)))
  const [rows, [openCount], [dismissedCount]] = await Promise.all([
    db
      .select({
        slug: experiences.slug,
        title: experiences.title,
        game: experiences.game,
        bugged: experiences.bugged,
        broken: experiences.broken,
        xpFarm: experiences.xpFarm,
        portalState: experiences.portalState,
        reports: {
          bugged: counted('bugged'),
          broken: counted('broken'),
          xp_farm: counted('xp_farm'),
        },
        total,
        last,
      })
      .from(experienceReports)
      .innerJoin(
        experiences,
        eq(experiences.id, experienceReports.experienceId),
      )
      .where(shown)
      .groupBy(experiences.id)
      .having(
        options.kind
          ? sql`count(*) filter (where ${experienceReports.type} = ${options.kind}) > 0`
          : undefined,
      )
      .orderBy(
        ...(options.sort === 'latest'
          ? [desc(last)]
          : [desc(total), desc(last)]),
        desc(experiences.id),
      )
      .limit(SHOWN),
    tally(open),
    tally(dealtWith),
  ])

  return {
    ok: true as const,
    state,
    items: rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      game: row.game,
      reports: row.reports,
      last: row.last,
      flags: {
        bugged: row.bugged,
        broken: row.broken,
        xpFarm: row.xpFarm,
        unavailable: isUnavailable(row),
      },
    })),
    counts: { open: openCount.value, dismissed: dismissedCount.value },
    now: new Date(),
  }
}

/** The live experience a moderator acts on, by its address. */
async function reported(slug: string) {
  const [found] = await db
    .select({ id: experiences.id })
    .from(experiences)
    .where(and(eq(experiences.slug, slug), isNull(experiences.deletedAt)))
    .limit(1)
  return found ?? null
}

/** Marks every open report on an experience dealt with, by whoever acts. */
const resolveOpen = (
  executor: Executor,
  experienceId: number,
  actor: Actor,
  now: Date,
) =>
  executor
    .update(experienceReports)
    .set({ resolvedAt: now, resolvedBy: actor.id })
    .where(
      and(
        eq(experienceReports.experienceId, experienceId),
        isNull(experienceReports.resolvedAt),
      ),
    )

/** Dismisses an experience's open reports: nothing needs changing. */
export async function dismissReports(
  actor: Actor | null,
  slug: string,
  now = new Date(),
): Promise<{ ok: true } | Refusal> {
  const refused = needsStaff(actor)
  if (refused || !actor) return refused ?? refuse('signed-out')
  const found = await reported(slug)
  if (!found) return refuse('not-found')
  await resolveOpen(db, found.id, actor, now)
  return { ok: true }
}

/**
 * Sets an experience's health flags as a moderator finds it, and so deals
 * with its open reports. Featured and trending are not health flags, and are
 * not set here.
 */
export async function setHealthFlags(
  actor: Actor | null,
  slug: string,
  flags: { bugged: boolean; broken: boolean; xpFarm: boolean },
  now = new Date(),
): Promise<{ ok: true } | Refusal> {
  const refused = needsStaff(actor)
  if (refused || !actor) return refused ?? refuse('signed-out')
  const found = await reported(slug)
  if (!found) return refuse('not-found')
  await db.transaction(async (tx) => {
    await tx
      .update(experiences)
      .set({ bugged: flags.bugged, broken: flags.broken, xpFarm: flags.xpFarm })
      .where(eq(experiences.id, found.id))
    await resolveOpen(tx, found.id, actor, now)
  })
  return { ok: true }
}
