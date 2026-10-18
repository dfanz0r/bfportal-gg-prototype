import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'

import { ADMIN_PAGE } from '../../shared/admin-search'
import { type Refusal, refuse } from '../../shared/results'
import { type Role, roles } from '../../shared/roles'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experiences, user } from '../db/schema'
import { needsAdmin } from './access'
import { outer } from './shared'

// The site's accounts, for the admins: to find someone and give them a role.
// Roles were set by hand in the database before this.

const madeCount = sql<number>`(select count(*)::int from ${experiences} where ${experiences.ownerId} = ${outer(user.id)} and ${experiences.deletedAt} is null and ${experiences.status} <> 'draft')`

/**
 * Accounts, staff first and then the newest, by role and a search of name and
 * Discord id. Their real names: this is the admins' own screen, so a hidden
 * name is shown, and said to be hidden.
 */
export async function listUsers(
  actor: Actor | null,
  options: { q?: string; role?: Role; page?: number } = {},
) {
  const refused = needsAdmin(actor)
  if (refused) return refused
  const page = options.page ?? 1
  const q = options.q?.trim()
  const where = and(
    options.role ? eq(user.role, options.role) : undefined,
    q
      ? or(ilike(user.name, `%${q}%`), ilike(user.discordId, `%${q}%`))
      : undefined,
  )
  const [rows, [matching], byRole] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
        discordId: user.discordId,
        role: user.role,
        hidden: user.hideUsername,
        joinedAt: user.createdAt,
        made: madeCount,
      })
      .from(user)
      .where(where)
      .orderBy(
        sql`case ${user.role} when 'admin' then 0 when 'moderator' then 1 else 2 end`,
        desc(user.createdAt),
        desc(user.id),
      )
      .limit(page * ADMIN_PAGE),
    db.select({ value: count() }).from(user).where(where),
    db
      .select({ role: user.role, value: count() })
      .from(user)
      .groupBy(user.role),
  ])
  return {
    ok: true as const,
    items: rows.map((row) => ({
      ...row,
      role: roles.find((role) => role === row.role) ?? 'user',
      you: row.id === actor?.id,
    })),
    total: matching.value,
    counts: Object.fromEntries(
      roles.map((role) => [
        role,
        byRole.find((row) => row.role === role)?.value ?? 0,
      ]),
    ) as Record<Role, number>,
    page,
    now: new Date(),
  }
}

/**
 * Gives an account a role. Only an admin may, and not to their own account:
 * an admin who could demote themselves could leave the site with none. The
 * last admin cannot be demoted by anyone either.
 */
export async function setRole(
  actor: Actor | null,
  userId: string,
  role: Role,
): Promise<{ ok: true } | Refusal> {
  const refused = needsAdmin(actor)
  if (refused || !actor) return refused ?? refuse('signed-out')
  if (userId === actor.id) {
    return refuse('invalid', { form: 'Another admin changes your role.' })
  }
  return db.transaction(async (tx) => {
    // One role change at a time, so two admins demoting each other at once
    // cannot both go through and leave none.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('roles', 0))`,
    )
    const [target] = await tx
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, userId))
    if (!target) return refuse('not-found')
    if (target.role === 'admin' && role !== 'admin') {
      const [{ value: admins }] = await tx
        .select({ value: count() })
        .from(user)
        .where(eq(user.role, 'admin'))
      if (admins <= 1) {
        return refuse('invalid', {
          form: 'The site needs an admin. Make another one first.',
        })
      }
    }
    await tx.update(user).set({ role }).where(eq(user.id, userId))
    return { ok: true as const }
  })
}
