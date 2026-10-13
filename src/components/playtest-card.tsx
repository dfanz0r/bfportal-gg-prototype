import { Link } from '@tanstack/solid-router'
import { Show } from 'solid-js'

import type { PlaytestItem } from '../functions/playtests'
import { CopyCode } from './copy-code'
import { DateText } from './date-text'
import { Regions } from './regions'
import { panel } from './ui'

/** A call for testers, in a listing. */
export function PlaytestCard(props: { playtest: PlaytestItem }) {
  const playtest = () => props.playtest
  return (
    <article class={`${panel} flex flex-col gap-2 p-4`}>
      <h3 class="text-[15px] font-semibold">
        <Link
          to="/playtests/$id"
          params={{ id: String(playtest().id) }}
          class="hover:text-steel-hi"
        >
          {playtest().name}
        </Link>
      </h3>
      <p class="text-sm leading-[1.5] text-fg-2">{playtest().summary}</p>
      <p class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-1.5 text-[13px] text-fg-3">
        <Regions regions={playtest().regions} />
        <Show when={playtest().closesAt} fallback="Open">
          {(closes) => (
            <span>
              {playtest().open ? 'Until' : 'Closed'}{' '}
              <DateText value={closes()} />
            </span>
          )}
        </Show>
        <span class="ml-auto">
          <CopyCode code={playtest().code} />
        </span>
      </p>
    </article>
  )
}
