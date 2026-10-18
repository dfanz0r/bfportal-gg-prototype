import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { Events } from '../functions/events'
import { EventCard } from './cards/event-card'
import { PageLayout } from './layout/page-layout'
import { Pills } from './ui/pills'
import { Tabs } from './ui/tabs'
import { pill } from './ui/ui'

const LEAD = 'Community nights, tournaments and workshops.'

/** The head of the events page. */
export function eventListHead() {
  return {
    meta: [
      { title: 'Events · bfportal.gg' },
      { name: 'description', content: LEAD },
    ],
  }
}

/** Community events, those to come or those past. */
export function EventList(props: { data: Events }) {
  const data = () => props.data

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
