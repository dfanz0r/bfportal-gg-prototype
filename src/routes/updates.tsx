import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'

export const Route = createFileRoute('/updates')({
  head: () => ({ meta: [{ title: 'Recent updates · bfportal.gg' }] }),
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
