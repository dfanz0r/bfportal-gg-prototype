import { createFileRoute } from '@tanstack/solid-router'

import { auth } from '../server/auth'

export const Route = createFileRoute('/logout')({
  server: {
    handlers: {
      // POST only: signing out changes state, so a link must not trigger it.
      GET: () =>
        new Response(null, { status: 405, headers: { Allow: 'POST' } }),
      POST: async ({ request }) => {
        await auth.api.signOut({ headers: request.headers })
        return new Response(null, { status: 303, headers: { Location: '/' } })
      },
    },
  },
})
