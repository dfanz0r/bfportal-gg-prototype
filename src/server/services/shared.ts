import type { db } from '../db'
import { user } from '../db/schema'

// Small things several services use and none of them owns.

/** The database, or a transaction on it: whatever a query runs on. */
export type Executor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]

export function groupBy<T, K>(items: T[], key: (item: T) => K) {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const group = groups.get(key(item))
    if (group) group.push(item)
    else groups.set(key(item), [item])
  }
  return groups
}

/**
 * Whether a failed write was refused by one unique constraint: the value was
 * taken between reading it as free and writing it.
 */
export function violates(error: unknown, constraint: string) {
  for (
    let current = error;
    current;
    current = (current as { cause?: unknown }).cause
  ) {
    const { code, constraint_name: name } = current as {
      code?: string
      constraint_name?: string
    }
    if (code === '23505' && name === constraint) return true
  }
  return false
}

/** The first line of a description, without Markdown's markers. */
export function excerpt(markdown: string) {
  const line =
    markdown
      .split('\n')
      .map((text) => text.replace(/^[\s#>*-]+|[\s#*]+$/g, '').trim())
      .find(Boolean) ?? ''
  return line.length > 180 ? `${line.slice(0, 177).trimEnd()}…` : line
}

/**
 * What to select of a user to show them in public. Read it with
 * `publicPerson`, which is where a hidden name is honored.
 */
export const personColumns = {
  name: user.name,
  image: user.image,
  discordId: user.discordId,
  hidden: user.hideUsername,
}

/**
 * A person as the public may see them: their name, picture and the Discord id
 * their profile lives at. Null for someone who hides their name, and for a
 * join that found nobody.
 */
export function publicPerson(
  row: {
    name: string
    image: string | null
    discordId: string
    hidden: boolean
  } | null,
) {
  return row && !row.hidden
    ? { name: row.name, image: row.image, discordId: row.discordId }
    : null
}

export type PublicPerson = NonNullable<ReturnType<typeof publicPerson>>
