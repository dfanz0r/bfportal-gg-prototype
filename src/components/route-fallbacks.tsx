import { Link } from '@tanstack/solid-router'

import { PageHead } from './page-head'
import { buttonGhost } from './ui'

export function NotFound() {
  return (
    <main id="content">
      <PageHead
        title="Page not found"
        lead="Nothing lives at this address. It may have moved, or the link may be wrong."
      />
      <div class="wrap py-8">
        <Link to="/" class={buttonGhost}>
          Back to the home page
        </Link>
      </div>
    </main>
  )
}

export function RouteError() {
  return (
    <main id="content">
      <PageHead
        title="Something went wrong"
        lead="The page could not be shown. Try again in a moment."
      />
    </main>
  )
}
