import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { type JSX, Suspense } from 'solid-js'
import { HydrationScript } from 'solid-js/web'

import { SiteFooter } from '../components/layout/site-footer'
import { SiteHeader } from '../components/layout/site-header'
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
    links: [
      { rel: 'stylesheet', href: styleCss },
      { rel: 'icon', href: '/logo-mark.svg', type: 'image/svg+xml' },
      // The headline face, so the first paint is not in a fallback font.
      {
        rel: 'preload',
        href: '/fonts/big-shoulders-display-500-900.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument(props: { children: JSX.Element }) {
  return (
    <html lang="en">
      <head>
        <HydrationScript />
        <HeadContent />
      </head>
      <body>
        {props.children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  const user = Route.useLoaderData()

  return (
    <>
      <a
        href="#content"
        class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-steel focus:px-3 focus:py-2 focus:text-steel-ink"
      >
        Skip to content
      </a>
      {/* The footer sits at the bottom of the window on a short page. */}
      <div class="flex min-h-screen flex-col">
        <SiteHeader user={user()} />
        <div class="flex-1">
          <Suspense>
            <Outlet />
            <TanStackRouterDevtools />
          </Suspense>
        </div>
        <SiteFooter />
      </div>
    </>
  )
}
