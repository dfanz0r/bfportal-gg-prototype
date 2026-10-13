import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'

export const Route = createFileRoute('/guides')({
  head: () => ({ meta: [{ title: 'Guides and docs · bfportal.gg' }] }),
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
