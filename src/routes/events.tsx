import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/events')({
  head: () => pageTitle('Events'),
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
