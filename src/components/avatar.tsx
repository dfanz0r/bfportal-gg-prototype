import { Show } from 'solid-js'

/** The first two letters of a name, for when there is no picture. */
export function initials(name: string) {
  return (
    name
      .replace(/[^\p{L}]/gu, '')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

/**
 * A person's picture, or their initials on steel. Decorative: the name is
 * always shown or announced next to it. Size it with `class`.
 *
 * A picture sits on the page's own dark, not on steel: many Discord pictures
 * are partly transparent, and steel shows through them as a pale box.
 */
export function Avatar(props: {
  name: string
  image?: string | null
  class?: string
}) {
  return (
    <span
      class={`grid shrink-0 place-items-center overflow-hidden font-mono text-xs font-semibold ${props.image ? 'bg-surface-2' : 'bg-steel text-steel-ink'} ${props.class ?? 'size-9'}`}
      aria-hidden="true"
    >
      <Show when={props.image} fallback={initials(props.name)}>
        {(image) => <img src={image()} alt="" class="size-full object-cover" />}
      </Show>
    </span>
  )
}
