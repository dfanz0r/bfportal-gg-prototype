import { and, asc, count, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm'

import { db } from '../db'
import { eventInterest, events, user } from '../db/schema'
import { personColumns, publicPerson } from './shared'

// Community events. Only published ones are shown.

/** Events under way or still to come, soonest first; or past ones, latest first. */
export async function listEvents(
  options: { when: 'upcoming' | 'past'; limit: number },
  now = new Date(),
) {
  const upcoming = options.when === 'upcoming'
  const where = and(
    eq(events.published, true),
    upcoming ? gt(events.endsAt, now) : lte(events.endsAt, now),
  )
  const [rows, [matching]] = await Promise.all([
    db
      .select({
        id: events.id,
        slug: events.slug,
        title: events.title,
        summary: events.summary,
        linkUrl: events.linkUrl,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        capacity: events.capacity,
        host: personColumns,
      })
      .from(events)
      .innerJoin(user, eq(user.id, events.hostId))
      .where(where)
      .orderBy(upcoming ? asc(events.startsAt) : desc(events.startsAt))
      .limit(options.limit),
    db.select({ value: count() }).from(events).where(where),
  ])

  const interest =
    rows.length === 0
      ? []
      : await db
          .select({ eventId: eventInterest.eventId, value: count() })
          .from(eventInterest)
          .where(
            inArray(
              eventInterest.eventId,
              rows.map((event) => event.id),
            ),
          )
          .groupBy(eventInterest.eventId)

  return {
    total: matching.value,
    items: rows.map((event) => ({
      slug: event.slug,
      title: event.title,
      summary: event.summary,
      linkUrl: event.linkUrl,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      capacity: event.capacity,
      live: event.startsAt <= now && event.endsAt > now,
      host: publicPerson(event.host),
      interested: interest.find((row) => row.eventId === event.id)?.value ?? 0,
    })),
  }
}

export type EventItem = Awaited<ReturnType<typeof listEvents>>['items'][number]

/** How many events are to come and how many have passed, for the tabs. */
export async function countEvents(now = new Date()) {
  const [counts] = await db
    .select({
      upcoming: count(
        sql`case when ${events.endsAt} > ${now.toISOString()}::timestamptz then 1 end`,
      ),
      past: count(
        sql`case when ${events.endsAt} <= ${now.toISOString()}::timestamptz then 1 end`,
      ),
    })
    .from(events)
    .where(eq(events.published, true))
  return counts
}
