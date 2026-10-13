import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'

export const Route = createFileRoute('/events')({
  head: () => ({ meta: [{ title: 'Events · bfportal.gg' }] }),
  component: EventsPage,
})

function EventsPage() {
  return (
    <SectionPlaceholder
      title="Events"
      lead="Community nights, tournaments and playtests."
    />
  )
}
