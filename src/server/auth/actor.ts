import { getRequestHeaders } from '@tanstack/solid-start/server'

import { parseRole, type Role } from '../../shared/roles'
import { env, siteUrl } from '../env'
import { auth } from '.'
import { isFromThisSite } from './origin'

/**
 * Whoever is acting: the signed-in user, as far as the rules care. Services
 * take one of these, or null for a visitor, and decide what they may do. A
 * service never looks at the request to find out who is asking.
 */
export type Actor = { id: string; role: Role }

/** The signed-in user behind the current request, or null. */
export async function currentActor(): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: getRequestHeaders() })
  return session
    ? { id: session.user.id, role: parseRole(session.user.role) }
    : null
}

/**
 * Refuses a request that changes something unless it came from the site's own
 * pages. Every server function that writes calls this first: the session
 * cookie alone does not show that the visitor meant to do it.
 */
export function assertFromThisSite() {
  const origins = [siteUrl, env.BETTER_AUTH_URL].map(
    (url) => new URL(url).origin,
  )
  if (!isFromThisSite(getRequestHeaders(), origins)) {
    throw new Response('This request did not come from the site.', {
      status: 403,
    })
  }
}
