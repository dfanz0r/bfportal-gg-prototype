import { type Refusal, refuse } from '../../shared/results'
import { isAdmin, isStaff } from '../../shared/roles'
import type { Actor } from '../auth/actor'

// Who may use what in the admin. Every admin service asks one of these first:
// the guard on /admin keeps the pages out of view and protects nothing.

/** Refused unless a moderator or an admin is acting; null if they are. */
export function needsStaff(actor: Actor | null): Refusal | null {
  if (!actor) return refuse('signed-out')
  return isStaff(actor.role) ? null : refuse('forbidden')
}

/** Refused unless an admin is acting; null if one is. */
export function needsAdmin(actor: Actor | null): Refusal | null {
  if (!actor) return refuse('signed-out')
  return isAdmin(actor.role) ? null : refuse('forbidden')
}
