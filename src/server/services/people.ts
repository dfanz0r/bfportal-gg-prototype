import { and, asc, eq, ilike, inArray, ne, sql } from 'drizzle-orm'

import { type Refusal, refuse } from '../../shared/results'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { user } from '../db/schema'
import { allow } from '../rate-limit'
import { type PublicPerson, personColumns, publicPerson } from './shared'

/** The most people one search offers. */
export const PEOPLE_FOUND = 8
const SEARCHES_PER_MINUTE = 60

/**
 * The people at these Discord ids, in the order given, as the public may see
 * them. Anyone who hides their name, or is not here, is left out.
 */
export async function peopleByDiscordId(ids: string[]) {
  if (ids.length === 0) return []
  const rows = await db
    .select(personColumns)
    .from(user)
    .where(and(inArray(user.discordId, ids), eq(user.hideUsername, false)))
  return ids.flatMap((id) => {
    const person = publicPerson(
      rows.find((row) => row.discordId === id) ?? null,
    )
    return person ? [person] : []
  })
}

/**
 * People with an account here whose name has `query` in it, for someone
 * choosing who to credit. Names that begin with it come first. Someone who
 * hides their name is never offered, and neither is whoever is asking: they
 * are the owner already.
 */
export async function findPeople(
  actor: Actor | null,
  query: string,
): Promise<{ ok: true; people: PublicPerson[] } | Refusal> {
  if (!actor) return refuse('signed-out')
  const typed = query.trim()
  if (typed.length < 2) return { ok: true, people: [] }
  // Each letter typed is a search; this keeps a script from reading out the
  // whole list of members.
  if (!allow(`people:${actor.id}`, SEARCHES_PER_MINUTE, 60_000)) {
    return refuse('invalid', {
      form: 'That is a lot of searches. Wait a minute.',
    })
  }
  const escaped = typed.replace(/[\\%_]/g, '\\$&')
  const rows = await db
    .select(personColumns)
    .from(user)
    .where(
      and(
        ilike(user.name, `%${escaped}%`),
        eq(user.hideUsername, false),
        ne(user.id, actor.id),
      ),
    )
    .orderBy(
      sql`${user.name} ilike ${`${escaped}%`} desc`,
      asc(sql`lower(${user.name})`),
    )
    .limit(PEOPLE_FOUND)
  return {
    ok: true,
    people: rows.flatMap((row) => {
      const person = publicPerson(row)
      return person ? [person] : []
    }),
  }
}
