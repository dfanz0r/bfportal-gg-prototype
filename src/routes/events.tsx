import { createFileRoute } from '@tanstack/solid-router'

import { EventList, eventListHead } from '../components/event-list'
import { fetchEvents } from '../functions/events'
import { eventsSearchSchema } from '../shared/feed-search'

export const Route = createFileRoute('/events')({
  validateSearch: eventsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchEvents({ data: deps }),
  head: () => eventListHead(),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <EventList data={data()} />
}
