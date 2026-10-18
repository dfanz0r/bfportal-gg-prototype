import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/layout/section-placeholder'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/guides')({
  head: () => pageTitle('Guides and docs'),
  component: GuidesPage,
})

function GuidesPage() {
  return (
    <SectionPlaceholder
      title="Guides and docs"
      lead="Tutorials and reference written by the community."
      planned={[
        'Guides grouped by topic: rules, scripting, spatial editing, publishing.',
        'A start-here path for people new to Portal.',
        'Reference pages for the scripting API.',
      ]}
    />
  )
}
