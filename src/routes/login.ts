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

/**
 * The same for every request with no address, together: the header is missing
 * when something other than the expected proxy is in front, and that is not a
 * way around the limit.
 */
const SIGN_INS_PER_MINUTE_UNKNOWN = 60

export const Route = createFileRoute('/login')({
  server: {
    handlers: {
      // Straight to Discord: there is no login page.
      GET: async ({ request }) => {
        const ip = clientIp(request)
        const allowed = ip
          ? allow(`login:${ip}`, SIGN_INS_PER_MINUTE, 60 * 1000)
          : allow('login:unknown', SIGN_INS_PER_MINUTE_UNKNOWN, 60 * 1000)
        if (!allowed) {
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
