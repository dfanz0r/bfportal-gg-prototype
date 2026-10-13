import { createServerFn } from '@tanstack/solid-start'
import { getRequestHeaders } from '@tanstack/solid-start/server'

import { auth } from '../server/auth'
import { parseRole } from '../shared/roles'

/**
 * The signed-in user as the browser may see it, or null. The email stays on
 * the server.
 */
export const getSessionUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) {
      return null
    }
    const { user } = session
    return {
      id: user.id,
      name: user.name,
      image: user.image ?? null,
      discordId: user.discordId,
      role: parseRole(user.role),
    }
  },
)

export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof getSessionUser>>
>
