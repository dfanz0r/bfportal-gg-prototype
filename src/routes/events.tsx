import { createFileRoute, Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import { EventCard } from '../components/event-card'
import { PageLayout } from '../components/page-layout'
import { Pills } from '../components/pills'
import { Tabs } from '../components/tabs'
import { pill } from '../components/ui'
import { fetchEvents } from '../functions/events'
import { eventsSearchSchema } from '../shared/feed-search'

const LEAD = 'Community nights, tournaments and workshops.'

export const Route = createFileRoute('/events')({
  validateSearch: eventsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchEvents({ data: deps }),
  head: () => ({
    meta: [
      { title: 'Events · bfportal.gg' },
      { name: 'description', content: LEAD },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()

  return (
    <PageLayout title="Events" lead={LEAD}>
      <Tabs
        label="Playtests and events"
        items={[
          { name: 'Playtests', href: '/playtests' },
          {
            name: 'Community events',
            href: '/events',
            count: data().counts.upcoming,
            current: true,
          },
        ]}
      />
      <Pills label="When" class="mt-4">
        <Link
          to="/events"
          class={pill}
          aria-current={data().when === 'upcoming' ? 'true' : undefined}
        >
          Upcoming
          <span class="font-mono text-[11.5px] text-fg-3">
            {data().counts.upcoming}
          </span>
        </Link>
        <Link
          to="/events"
          search={{ when: 'past' }}
          class={pill}
          aria-current={data().when === 'past' ? 'true' : undefined}
        >
          Past
          <span class="font-mono text-[11.5px] text-fg-3">
            {data().counts.past}
          </span>
        </Link>
      </Pills>

      <Show
        when={data().items.length > 0}
        fallback={
          <p class="mt-6 border border-line bg-surface-1 px-5 py-10 text-center text-fg-2">
            {data().when === 'past'
              ? 'No past events yet.'
              : 'Nothing is planned right now.'}
          </p>
        }
      >
        <ul class="mt-6 grid gap-4 min-[680px]:grid-cols-2 min-[1100px]:grid-cols-4">
          <For each={data().items}>
            {(event) => <EventCard event={event} />}
          </For>
        </ul>
      </Show>
    </PageLayout>
  )
}
