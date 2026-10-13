import { Show } from 'solid-js'

import type { EventItem } from '../functions/events'
import { DateText } from './date-text'
import { PersonLink } from './person-link'
import { display, panel } from './ui'

/** A community event, in a listing. */
export function EventCard(props: { event: EventItem }) {
  const event = () => props.event
  return (
    <li
      id={event().slug}
      class={`${panel} flex scroll-mt-20 flex-col gap-2 p-4`}
    >
      <p class="flex flex-wrap items-center gap-2.5 font-mono text-xs text-fg-3">
        <Show when={event().live}>
          <span class="bg-live px-1.5 py-0.5 text-[10.5px] font-medium tracking-[0.1em] text-steel-ink uppercase">
            Live now
          </span>
        </Show>
        <DateText value={event().startsAt} />
      </p>
      <h3 class={`${display} text-2xl leading-[1.05] tracking-[0.015em]`}>
        {event().title}
      </h3>
      <p class="text-sm leading-[1.5] text-fg-2">{event().summary}</p>
      <p class="mt-auto flex flex-wrap gap-x-3 pt-1.5 text-[13px] text-fg-3">
        <Show when={event().host}>
          {(host) => (
            <span>
              Hosted by <PersonLink person={host()} />
            </span>
          )}
        </Show>
        <span>{event().interested} interested</span>
        <Show when={event().capacity}>
          {(capacity) => <span>{capacity()} places</span>}
        </Show>
      </p>
    </li>
  )
}
