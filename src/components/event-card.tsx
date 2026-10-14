import { Show } from 'solid-js'

import type { EventItem } from '../functions/events'
import { DateBlock } from './date-block'
import { DateText } from './date-text'
import { PersonLink } from './person-link'
import { display, panel } from './ui'

/** A community event, in a listing: the day it is on, then what it is. */
export function EventCard(props: { event: EventItem }) {
  const event = () => props.event
  return (
    <li
      id={event().slug}
      class={`${panel} flex scroll-mt-20 flex-col gap-3 p-4`}
    >
      <div class="flex items-start gap-3">
        <DateBlock value={event().startsAt} />
        <div class="min-w-0">
          <h3
            class={`${display} text-[22px] leading-[1.05] tracking-[0.015em]`}
          >
            {event().title}
          </h3>
          <p class="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11.5px] text-fg-3">
            <Show when={event().live}>
              <span class="bg-live px-1.5 py-0.5 text-[10.5px] font-medium tracking-[0.1em] text-steel-ink uppercase">
                Live now
              </span>
            </Show>
            <DateText value={event().startsAt} />
          </p>
          <Show when={event().host}>
            {(host) => (
              <p class="mt-0.5 text-[12.5px] text-fg-3">
                Hosted by <PersonLink person={host()} class="text-fg-2" />
              </p>
            )}
          </Show>
        </div>
      </div>
      <p class="text-sm leading-[1.5] text-fg-2">{event().summary}</p>
      <p class="mt-auto flex flex-wrap justify-between gap-x-3 border-t border-line pt-2.5 font-mono text-[11.5px] text-fg-3">
        <Show when={event().capacity} fallback={<span />}>
          {(capacity) => <span>{capacity()} places</span>}
        </Show>
        <span>{event().interested} interested</span>
      </p>
    </li>
  )
}
