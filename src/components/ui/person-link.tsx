import { Link } from '@tanstack/solid-router'
import { Show } from 'solid-js'

/**
 * A person's name, linking to their profile when they have one. A named
 * credit, for someone with no account, is just the name.
 */
export function PersonLink(props: {
  person: { name: string; discordId?: string | null }
  class?: string
}) {
  return (
    <Show
      when={props.person.discordId}
      fallback={<span class={props.class}>{props.person.name}</span>}
    >
      {(discordId) => (
        <Link
          to="/users/$discordId"
          params={{ discordId: discordId() }}
          class={`relative hover:text-fg hover:underline ${props.class ?? ''}`}
        >
          {props.person.name}
        </Link>
      )}
    </Show>
  )
}
