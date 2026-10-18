import { Link } from '@tanstack/solid-router'
import { Show } from 'solid-js'

import type { SnippetItem } from '../../functions/snippets'
import { LikeButton } from '../ui/like-button'
import { PersonLink } from '../ui/person-link'
import { tag } from '../ui/ui'

/** A snippet, as a row in a list. */
export function SnippetRow(props: { snippet: SnippetItem }) {
  const snippet = () => props.snippet
  return (
    <li class="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3.5">
      {/* What it is made of: TypeScript, so far the only kind. */}
      <span
        class="grid size-11 shrink-0 place-items-center border border-line bg-surface-3 font-mono text-xs font-semibold text-steel"
        aria-hidden="true"
      >
        TS
      </span>
      <div class="min-w-0 flex-1 basis-64">
        <p class="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
          <Link
            to="/snippets/$slug"
            params={{ slug: snippet().slug }}
            class="hover:text-steel-hi"
          >
            {snippet().title}
          </Link>
          <Show when={snippet().category}>
            {(category) => (
              <span class={`${tag} border-line text-fg-2`}>{category()}</span>
            )}
          </Show>
        </p>
        <p class="truncate text-[13.5px] text-fg-2">{snippet().excerpt}</p>
        <Show when={snippet().owner}>
          {(owner) => (
            <p class="mt-0.5 text-[12.5px] text-fg-3">
              by <PersonLink person={owner()} class="text-fg-2" />
            </p>
          )}
        </Show>
      </div>
      {/* A list does not know whether its visitor is signed in: the button
          asks, as a card's does. */}
      <LikeButton
        kind="snippet"
        slug={snippet().slug}
        likes={snippet().likes}
        liked={snippet().liked}
        look="row"
      />
    </li>
  )
}
