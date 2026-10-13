import { Link, useNavigate } from '@tanstack/solid-router'
import type { JSX } from 'solid-js'
import { Show } from 'solid-js'

import type { Game } from '../shared/content'
import { defaultGame } from '../shared/games'
import {
  type LibrarySearch,
  librarySearchParams,
} from '../shared/library-search'

type Props = {
  game: Game
  search?: LibrarySearch
  class?: string
  /** Stay where the page is scrolled, for links that change what is listed. */
  keepScroll?: boolean
  'aria-current'?: 'page' | 'true'
  children: JSX.Element
}

/**
 * A link to a game's Library tab. The first game has the bare address and the
 * others have their own path, so this is where that difference is kept.
 */
export function LibraryLink(props: Props) {
  const search = () => librarySearchParams(props.search ?? {})
  return (
    <Show
      when={props.game !== defaultGame.id}
      fallback={
        <Link
          to="/library"
          search={search()}
          resetScroll={!props.keepScroll}
          class={props.class}
          aria-current={props['aria-current']}
        >
          {props.children}
        </Link>
      }
    >
      <Link
        to="/library/$game"
        params={{ game: props.game }}
        search={search()}
        resetScroll={!props.keepScroll}
        class={props.class}
        aria-current={props['aria-current']}
      >
        {props.children}
      </Link>
    </Show>
  )
}

/** Goes to a game's Library tab with a search, keeping the scroll position. */
export function useLibraryNavigate() {
  const navigate = useNavigate()
  return (game: Game, search: LibrarySearch) => {
    const options = {
      search: librarySearchParams(search),
      resetScroll: false,
    }
    return game === defaultGame.id
      ? navigate({ to: '/library', ...options })
      : navigate({ to: '/library/$game', params: { game }, ...options })
  }
}
