import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/updates')({
  head: () => pageTitle('Recent updates'),
  component: UpdatesPage,
})

function UpdatesPage() {
  return (
    <SectionPlaceholder
      title="Recent updates"
      lead="Release notes, status reports and calls for testers, posted by creators on their own projects."
    />
  )
}
