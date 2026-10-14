import type { JSX } from 'solid-js'

/** A row of filter links. Give each one the `pill` class. */
export function Pills(props: {
  label: string
  class?: string
  children: JSX.Element
}) {
  return (
    <nav
      class={`flex flex-wrap items-center gap-2 ${props.class ?? ''}`}
      aria-label={props.label}
    >
      {props.children}
    </nav>
  )
}
