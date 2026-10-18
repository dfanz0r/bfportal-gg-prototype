import type { JSX } from 'solid-js'

import { Icon } from '../ui/icon'

/** A checkbox or a radio button with its label, drawn as a square. */
export function Check(props: {
  name: string
  value: string
  checked?: boolean
  radio?: boolean
  children: JSX.Element
}) {
  return (
    <label class="inline-flex min-h-[34px] cursor-pointer items-center gap-2 pr-1 text-sm text-fg-2 has-checked:text-fg">
      <input
        type={props.radio ? 'radio' : 'checkbox'}
        name={props.name}
        value={props.value}
        checked={props.checked}
        class="peer sr-only"
      />
      <span class="grid size-4 shrink-0 place-items-center border border-line-strong text-transparent peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-steel">
        <Icon name="check" class="size-3" />
      </span>
      {props.children}
    </label>
  )
}
