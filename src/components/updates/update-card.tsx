import { Show } from 'solid-js'

import type { UpdateItem } from '../../functions/updates'
import { gameInfo } from '../../shared/games'
import { Byline } from '../ui/byline'
import { DateText } from '../ui/date-text'
import { display, panel, tag } from '../ui/ui'

/**
 * An update post in a listing, with the project it is about and that
 * project's picture. A card on the home page; with `row`, an entry of the
 * feed, which has room for a larger picture.
 */
export function UpdateCard(props: {
  update: UpdateItem
  now: Date
  row?: boolean
}) {
  const update = () => props.update
  const href = () =>
    update().project.kind === 'experience'
      ? `/experiences/${update().project.slug}`
      : `/snippets/${update().project.slug}`

  return (
    <article
      class={
        props.row
          ? 'flex gap-4 border-b border-line py-4'
          : `${panel} flex gap-3.5 p-4`
      }
    >
      {/* Decoration: the project's name beside it is the link. A snippet has
          no picture; it shows what it is made of. */}
      <div
        aria-hidden="true"
        class={`grid shrink-0 place-items-center overflow-hidden bg-surface-3 font-mono text-xs font-semibold text-steel ${props.row ? 'h-[81px] w-36 max-sm:hidden' : 'h-10 w-16'}`}
      >
        <Show when={update().project.coverImgUrl} fallback="TS">
          {(cover) => (
            <img
              src={cover()}
              alt=""
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              class="size-full object-cover"
            />
          )}
        </Show>
      </div>
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <p class="flex flex-wrap items-center gap-2 text-[13px] text-fg-2">
          <a href={href()} class="font-semibold text-fg hover:text-steel-hi">
            {update().project.title}
          </a>
          <span class={`${tag} border-line text-fg-2`}>
            {update().project.kind === 'experience' ? 'Experience' : 'Snippet'}
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
          <a href={`${href()}#updates`} class="hover:text-accent-hi">
            {update().title}
          </a>
        </h3>
        <p
          class={`text-sm leading-[1.5] text-fg-2 ${props.row ? 'line-clamp-2 max-w-[46em]' : 'line-clamp-3'}`}
        >
          {update().excerpt}
        </p>
        <p class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[13px] text-fg-3">
          <Byline person={update().author} />
          <Show when={update().publishedAt}>
            {(published) => <DateText value={published()} now={props.now} />}
          </Show>
        </p>
      </div>
    </article>
  )
}
