import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/scripts')({
  head: () => pageTitle('Scripts'),
  component: ScriptsPage,
})

function ScriptsPage() {
  return (
    <SectionPlaceholder
      title="Scripts"
      lead="Rules, logic and interface snippets for the Battlefield 6 Portal editor."
    />
  )
}
