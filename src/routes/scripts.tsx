import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'

export const Route = createFileRoute('/scripts')({
  head: () => ({ meta: [{ title: 'Scripts · bfportal.gg' }] }),
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
