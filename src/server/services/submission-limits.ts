import { count, eq, sql } from 'drizzle-orm'

import { type Refusal, refuse } from '../../shared/results'
import { isStaff } from '../../shared/roles'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experiences, snippets } from '../db/schema'
import { allow } from '../rate-limit'
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
 * How many times one account may send changes in an hour: to one waiting
 * for review, or to something live. Each asks Portal about its code again,
 * which is someone else's service, so it is counted in memory as other calls
 * to it are.
 */
export const RESENDS_PER_HOUR = 20

/** Refused when an account has sent changes too often, or null. */
export function resendLimit(actor: Actor): Refusal | null {
  return allow(`resend:${actor.id}`, RESENDS_PER_HOUR, 60 * 60 * 1000)
    ? null
    : refuse('invalid', {
        form: `You can send changes ${RESENDS_PER_HOUR} times an hour. Try again later.`,
      })
}

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
  // Waiting: what is in the queue now, so not what its owner deleted. Today:
  // everything sent in during the last day, deleted or not, or deleting
  // would give the place back. A draft saved and not sent is neither.
  const counts = (table: typeof experiences | typeof snippets) =>
    executor
      .select({
        waiting: count(
          sql`case when ${table.status} = 'pending' and ${table.deletedAt} is null then 1 end`,
        ),
        today: count(
          sql`case when ${table.status} <> 'draft' and ${table.submittedAt} > ${since}::timestamptz then 1 end`,
        ),
      })
      .from(table)
      .where(eq(table.ownerId, actor.id))
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
 * place. With `counted: false`, for one already waiting that is sent again,
 * it is written under the same lock and not counted.
 */
export async function withinLimit<T>(
  actor: Actor,
  now: Date,
  write: (tx: Executor) => Promise<T>,
  options: { counted?: boolean } = {},
): Promise<T | Refusal> {
  return db.transaction(async (tx) => {
    // Held until the transaction ends. The account's next submission waits
    // here, and then counts this one.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`submission:${actor.id}`}, 0))`,
    )
    const limited =
      options.counted === false ? null : await submissionLimit(actor, now, tx)
    return limited ?? write(tx)
  })
}
