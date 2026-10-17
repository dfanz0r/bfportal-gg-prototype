import { createFileRoute } from '@tanstack/solid-router'
import { APIError } from 'better-auth/api'

import { auth } from '../server/auth'
import { clientIp } from '../server/env'
import { allow } from '../server/rate-limit'

/**
 * How many sign-ins one address may start in a minute. Each one writes a row
 * for its state, and this is called directly, past Better Auth's own limit,
 * so it keeps one of its own.
 */
const SIGN_INS_PER_MINUTE = 10

export const Route = createFileRoute('/login')({
  server: {
    handlers: {
      // Straight to Discord: there is no login page.
      GET: async ({ request }) => {
        const ip = clientIp(request)
        if (ip && !allow(`login:${ip}`, SIGN_INS_PER_MINUTE, 60 * 1000)) {
          return new Response(
            'Too many sign-in attempts from here. Try again in a minute.',
            { status: 429, headers: { 'Retry-After': '60' } },
          )
        }
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
