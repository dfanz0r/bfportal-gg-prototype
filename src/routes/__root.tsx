import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { Suspense } from 'solid-js'
import { HydrationScript } from 'solid-js/web'

import { getSessionUser } from '../functions/session'
import styleCss from '../styles.css?url'

export const Route = createRootRoute({
  // The signed-in user, read once per page load and kept until
  // `router.invalidate()`. Signing in and out are full page loads. A
  // `beforeLoad` here would call the server on every navigation and preload.
  loader: () => getSessionUser(),
  staleTime: Number.POSITIVE_INFINITY,
  head: () => ({
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'bfportal.gg' },
    ],
    links: [{ rel: 'stylesheet', href: styleCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HydrationScript />
        <HeadContent />
      </head>
      <body>
        <Suspense>
          <Outlet />
          <TanStackRouterDevtools />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}
