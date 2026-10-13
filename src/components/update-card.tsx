import { Show } from 'solid-js'

import type { UpdateItem } from '../functions/updates'
import { gameInfo } from '../shared/games'
import { Byline } from './byline'
import { DateText } from './date-text'
import { display, panel, tag } from './ui'

/** An update post in a listing, with the project it is about. */
export function UpdateCard(props: { update: UpdateItem; now: Date }) {
  const update = () => props.update
  const href = () =>
    update().project.kind === 'experience'
      ? `/experiences/${update().project.slug}`
      : `/scripts/${update().project.slug}`

  return (
    <article class={`${panel} flex flex-col gap-2 p-4`}>
      <p class="flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
        <a href={href()} class="font-semibold text-fg hover:text-steel-hi">
          {update().project.title}
        </a>
        <span class={`${tag} border-line text-fg-2`}>
          {update().project.kind === 'experience' ? 'Experience' : 'Script'}
        </span>
        <Show when={update().project.game}>
          {(game) => (
            <span class={`${tag} border-line text-fg-2`}>
              {gameInfo(game()).name}
            </span>
          )}
        </Show>
      </p>
      <h3 class={`${display} text-2xl leading-[1.05] tracking-[0.015em]`}>
        <a href={`${href()}#updates`} class="hover:text-steel-hi">
          {update().title}
        </a>
      </h3>
      <p class="line-clamp-3 text-sm leading-[1.5] text-fg-2">
        {update().excerpt}
      </p>
      <p class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-[13px] text-fg-3">
        <Byline person={update().author} />
        <Show when={update().publishedAt}>
          {(published) => <DateText value={published()} now={props.now} />}
        </Show>
      </p>
    </article>
  )
}
