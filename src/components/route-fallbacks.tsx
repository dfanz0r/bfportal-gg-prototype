import { Link } from '@tanstack/solid-router'

import { PageLayout } from './page-layout'
import { buttonGhost } from './ui'

export function NotFound() {
  return (
    <PageLayout
      title="Page not found"
      lead="Nothing lives at this address. It may have moved, or the link may be wrong."
    >
      <Link to="/" class={buttonGhost}>
        Back to the home page
      </Link>
    </PageLayout>
  )
}

export function RouteError(props: { error: unknown }) {
  // The page says nothing about what failed; the console has to, or whoever
  // is looking into it has only "something went wrong" to go on.
  console.error(props.error)
  return (
    <PageLayout
      title="Something went wrong"
      lead="The page could not be shown. Try again in a moment."
    />
  )
}
