import { Show } from 'solid-js'

import { Avatar } from './avatar'
import { PersonLink } from './person-link'

/** "by Matavatar", with their picture. Nothing for someone who hides their name. */
export function Byline(props: {
  person: {
    name: string
    image: string | null
    discordId?: string | null
  } | null
  class?: string
}) {
  return (
    <Show when={props.person}>
      {(person) => (
        <span
          class={`inline-flex items-center gap-[7px] text-[13px] text-fg-2 ${props.class ?? ''}`}
        >
          <Avatar
            name={person().name}
            image={person().image}
            class="size-5 text-[9px]"
          />
          <span>
            by <PersonLink person={person()} />
          </span>
        </span>
      )}
    </Show>
  )
}
