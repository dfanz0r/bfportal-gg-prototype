import { Show } from 'solid-js'

import { move } from '../../functions/admin-taxonomy'
import type { Game } from '../../shared/content'
import { Icon } from '../ui/icon'
import { PostForm } from '../ui/post-form'
import { iconButton } from '../ui/ui'

/** Moves a row one place up or down its list, the order the site shows. */
export function MoveButtons(props: {
  what: 'category' | 'tag-group' | 'tag'
  id: number
  name: string
  first: boolean
  last: boolean
  /** For a category: the game whose list it is shown in. */
  game?: Game
}) {
  return (
    <PostForm action={move} class="flex gap-1">
      <input type="hidden" name="what" value={props.what} />
      <input type="hidden" name="id" value={props.id} />
      <Show when={props.game}>
        {(game) => <input type="hidden" name="game" value={game()} />}
      </Show>
      <button
        type="submit"
        name="direction"
        value="up"
        disabled={props.first}
        aria-label={`Move ${props.name} up`}
        class={`${iconButton} size-[34px] disabled:opacity-30`}
      >
        <Icon name="chevron-up" class="size-4" />
      </button>
      <button
        type="submit"
        name="direction"
        value="down"
        disabled={props.last}
        aria-label={`Move ${props.name} down`}
        class={`${iconButton} size-[34px] disabled:opacity-30`}
      >
        <Icon name="chevron-down" class="size-4" />
      </button>
    </PostForm>
  )
}
