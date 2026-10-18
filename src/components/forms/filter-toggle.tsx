import type { JSX } from 'solid-js'

import { Icon } from '../ui/icon'

/** A filter that is on or off: a real checkbox, drawn as a square. */
export function FilterToggle(props: {
  name: string
  value?: string
  checked: boolean
  children: JSX.Element
}) {
  return (
    <label class="inline-flex h-[34px] cursor-pointer items-center gap-2 pr-1 pl-0.5 text-[13.5px] text-fg-2 has-checked:text-fg">
      <input
        type="checkbox"
        name={props.name}
        value={props.value ?? 'true'}
        checked={props.checked}
        class="peer sr-only"
      />
      <span class="grid size-4 place-items-center border border-line-strong text-transparent peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-steel">
        <Icon name="check" class="size-3" />
      </span>
      {props.children}
    </label>
  )
}
