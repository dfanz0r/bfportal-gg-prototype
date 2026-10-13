import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/library')({
  head: () => pageTitle('Experience library'),
  component: LibraryPage,
})

function LibraryPage() {
  return (
    <SectionPlaceholder
      title="Experience library"
      lead="Every experience shared with the community, for Battlefield 6 and Battlefield 2042."
    />
  )
}
