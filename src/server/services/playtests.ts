import { and, count, desc, eq, gt, isNull, lte, or } from 'drizzle-orm'

import { db } from '../db'
import { experiences, playtests, updates, user } from '../db/schema'
import { visible } from './experience-cards'
import { personColumns, publicPerson } from './shared'

// Playtests: calls for testers, with a brief and a Discord thread. Only
// approved ones are ever shown.

const approved = eq(playtests.status, 'approved')

const isOpen = (now: Date) =>
  and(
    approved,
    lte(playtests.opensAt, now),
    or(isNull(playtests.closesAt), gt(playtests.closesAt, now)),
  )

const isClosed = (now: Date) => and(approved, lte(playtests.closesAt, now))

const card = {
  id: playtests.id,
  title: playtests.title,
  game: playtests.game,
  summary: playtests.summary,
  regions: playtests.regions,
  code: playtests.code,
  opensAt: playtests.opensAt,
  closesAt: playtests.closesAt,
  hasResult: playtests.resultUpdateId,
  experienceSlug: experiences.slug,
  experienceTitle: experiences.title,
}

/** Playtests with the experience each is for, when that one is public. */
const cards = () =>
  db
    .select(card)
    .from(playtests)
    // An experience that is not public lends neither its name nor a link.
    .leftJoin(
      experiences,
      and(eq(experiences.id, playtests.experienceId), visible),
    )

type Row = Awaited<ReturnType<typeof cards>>[number]

const toCard = (row: Row, now: Date) => ({
  id: row.id,
  // One for something with no page yet goes by its own title.
  name: row.experienceTitle ?? row.title ?? 'Untitled',
  experienceSlug: row.experienceSlug,
  game: row.game,
  summary: row.summary,
  regions: row.regions,
  code: row.code,
  opensAt: row.opensAt,
  closesAt: row.closesAt,
  // Open until its end date, or until its host closes it if it has none.
  open: row.closesAt === null || row.closesAt > now,
  hasResult: row.hasResult !== null,
})

/** Open playtests, newest first, or the ones that closed most recently. */
export async function listPlaytests(
  options: { state: 'open' | 'closed'; limit: number },
  now = new Date(),
) {
  const where = options.state === 'open' ? isOpen(now) : isClosed(now)
  const [rows, [matching]] = await Promise.all([
    cards()
      .where(where)
      .orderBy(
        desc(options.state === 'open' ? playtests.opensAt : playtests.closesAt),
      )
      .limit(options.limit),
    db.select({ value: count() }).from(playtests).where(where),
  ])
  return { total: matching.value, items: rows.map((row) => toCard(row, now)) }
}

export type PlaytestItem = ReturnType<typeof toCard>

/** One playtest's page, or null unless it was approved and has opened. */
export async function getPlaytest(id: number, now = new Date()) {
  const [row] = await db
    .select({
      ...card,
      briefHtml: playtests.briefHtml,
      discordUrl: playtests.discordUrl,
      togetherAt: playtests.togetherAt,
      host: personColumns,
      resultTitle: updates.title,
    })
    .from(playtests)
    .innerJoin(user, eq(user.id, playtests.hostId))
    .leftJoin(
      experiences,
      and(eq(experiences.id, playtests.experienceId), visible),
    )
    .leftJoin(
      updates,
      and(
        eq(updates.id, playtests.resultUpdateId),
        eq(updates.status, 'published'),
        isNull(updates.deletedAt),
      ),
    )
    .where(and(eq(playtests.id, id), approved, lte(playtests.opensAt, now)))
    .limit(1)
  if (!row) return null

  return {
    ...toCard(row, now),
    briefHtml: row.briefHtml,
    discordUrl: row.discordUrl,
    togetherAt: row.togetherAt,
    host: publicPerson(row.host),
    resultTitle: row.resultTitle,
    now,
  }
}
