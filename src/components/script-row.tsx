import { Link } from '@tanstack/solid-router'
import { Show } from 'solid-js'

import type { ScriptItem } from '../functions/scripts'
import { Icon } from './icon'
import { PersonLink } from './person-link'
import { tag } from './ui'

/** A script, as a row in a list. */
export function ScriptRow(props: { script: ScriptItem }) {
  const script = () => props.script
  return (
    <li class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5">
      <span
        class="grid size-11 shrink-0 place-items-center border border-line bg-surface-3 font-mono text-xs font-semibold text-steel"
        aria-hidden="true"
      >
        TS
      </span>
      <div class="min-w-0 flex-1 basis-64">
        <p class="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
          <Link
            to="/scripts/$slug"
            params={{ slug: script().slug }}
            class="hover:text-steel-hi"
          >
            {script().title}
          </Link>
          <Show when={script().category}>
            {(category) => (
              <span class={`${tag} border-line text-fg-2`}>{category()}</span>
            )}
          </Show>
        </p>
        <p class="truncate text-[13.5px] text-fg-2">{script().excerpt}</p>
        <Show when={script().owner}>
          {(owner) => (
            <p class="mt-0.5 text-[12.5px] text-fg-3">
              by <PersonLink person={owner()} class="text-fg-2" />
            </p>
          )}
        </Show>
      </div>
      <span class="inline-flex items-center gap-1.5 font-mono text-xs text-fg-2 tabular-nums">
        <Icon name="heart" class="size-3.5 fill-current text-accent" />
        {script().likes}
        <span class="sr-only"> likes</span>
      </span>
    </li>
  )
}
