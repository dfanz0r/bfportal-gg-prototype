import { createFileRoute } from '@tanstack/solid-router'

import { signOutAndRedirect } from '../server/auth/sign-out'

export const Route = createFileRoute('/logout')({
  server: {
    handlers: {
      // POST only: signing out changes state, so a link must not trigger it.
      GET: () =>
        new Response(null, { status: 405, headers: { Allow: 'POST' } }),
      POST: ({ request }) => signOutAndRedirect(request),
    },
  },
})
