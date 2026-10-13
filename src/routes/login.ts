import { createFileRoute } from '@tanstack/solid-router'
import { APIError } from 'better-auth/api'

import { auth } from '../server/auth'

export const Route = createFileRoute('/login')({
  server: {
    handlers: {
      // Straight to Discord: there is no login page.
      GET: async () => {
        try {
          const { url } = await auth.api.signInSocial({
            body: { provider: 'discord', callbackURL: '/' },
          })
          if (!url) {
            throw new Error('Better Auth returned no authorization URL')
          }
          return new Response(null, { status: 302, headers: { Location: url } })
        } catch (error) {
          if (error instanceof APIError && error.status === 'NOT_FOUND') {
            return new Response('Discord login is not configured.', {
              status: 503,
            })
          }
          throw error
        }
      },
    },
  },
})
