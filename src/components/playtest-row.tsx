import { Link } from '@tanstack/solid-router'
import { Show } from 'solid-js'

import type { PlaytestItem } from '../functions/playtests'
import { CopyCode } from './copy-code'
import { DateText } from './date-text'
import { Regions } from './regions'
import { buttonGhost } from './ui'

/**
 * A call for testers, as a row of the playtests list: what it is and what is
 * asked, how long it is open, and the code with the way to its brief.
 */
export function PlaytestRow(props: { playtest: PlaytestItem }) {
  const playtest = () => props.playtest
  return (
    <li class="flex flex-wrap items-center gap-x-6 gap-y-3 py-4">
      <div class="min-w-0 flex-1 basis-80">
        <p class="text-[13px] font-semibold text-fg-2">{playtest().name}</p>
        <p class="mt-0.5 text-[15.5px] leading-[1.35] font-semibold text-fg">
          <Link
            to="/playtests/$id"
            params={{ id: String(playtest().id) }}
            class="hover:text-accent-hi"
          >
            {playtest().summary}
          </Link>
        </p>
        <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-fg-3">
          <Regions regions={playtest().regions} />
          <span>
            Opened <DateText value={playtest().opensAt} />
          </span>
        </p>
      </div>
      <p class="w-40 text-[13px] font-semibold text-fg">
        <Show when={playtest().closesAt} fallback="Open until closed">
          {(closes) => (
            <>
              {playtest().open ? 'Open until' : 'Closed'}{' '}
              <DateText value={closes()} />
            </>
          )}
        </Show>
        <Show when={playtest().hasResult}>
          <span class="mt-0.5 block font-normal text-fg-3">Results posted</span>
        </Show>
      </p>
      <div class="grid w-[150px] gap-1.5">
        <CopyCode code={playtest().code} />
        <Link
          to="/playtests/$id"
          params={{ id: String(playtest().id) }}
          class={`${buttonGhost} h-[30px] px-2.5 text-xs`}
        >
          Read the brief
        </Link>
      </div>
    </li>
  )
}
