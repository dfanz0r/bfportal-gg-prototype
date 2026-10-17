import { and, count, eq, isNull, sql } from 'drizzle-orm'

import { type Refusal, refuse } from '../../shared/results'
import { isStaff } from '../../shared/roles'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experiences, snippets } from '../db/schema'
import type { Executor } from './shared'

// How much one account may send in for a moderator to look at. Experiences
// and snippets count together: every one of either is a moderator's time.
// Moderators and admins are trusted not to flood their own queue.

/** How many submissions one account may have waiting for a moderator. */
export const MAX_WAITING = 5
/** How many one account may send in a day. */
export const MAX_PER_DAY = 10

const DAY = 24 * 60 * 60 * 1000

/**
 * Why whoever is acting may not send in another submission just now, or null
 * if they may. A form can be told early, before anything is looked up; only
 * `withinLimit` decides.
 */
export async function submissionLimit(
  actor: Actor,
  now: Date,
  executor: Executor = db,
): Promise<Refusal | null> {
  if (isStaff(actor.role)) return null
  const since = new Date(now.getTime() - DAY).toISOString()
  const counts = (table: typeof experiences | typeof snippets) =>
    executor
      .select({
        waiting: count(sql`case when ${table.status} = 'pending' then 1 end`),
        today: count(
          sql`case when ${table.submittedAt} > ${since}::timestamptz then 1 end`,
        ),
      })
      .from(table)
      .where(and(eq(table.ownerId, actor.id), isNull(table.deletedAt)))
  const [[one], [other]] = await Promise.all([
    counts(experiences),
    counts(snippets),
  ])
  const waiting = one.waiting + other.waiting
  const today = one.today + other.today
  if (waiting >= MAX_WAITING) {
    return refuse('invalid', {
      form: `You have ${waiting} submissions waiting for a moderator. Once some of those are looked at you can send more.`,
    })
  }
  if (today >= MAX_PER_DAY) {
    return refuse('invalid', {
      form: `You have sent ${today} submissions in the last day, which is the most allowed. Try again tomorrow.`,
    })
  }
  return null
}

/**
 * Writes a submission for whoever is acting, if they may send one now: the
 * count and the write are one transaction. Two from one account at once, of
 * either kind, go one after the other, so both cannot take the same last
 * place.
 */
export async function withinLimit<T>(
  actor: Actor,
  now: Date,
  write: (tx: Executor) => Promise<T>,
): Promise<T | Refusal> {
  return db.transaction(async (tx) => {
    // Held until the transaction ends. The account's next submission waits
    // here, and then counts this one.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`submission:${actor.id}`}, 0))`,
    )
    return (await submissionLimit(actor, now, tx)) ?? write(tx)
  })
}
