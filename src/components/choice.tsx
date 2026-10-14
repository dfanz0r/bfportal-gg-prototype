import type { JSX } from 'solid-js'

/**
 * One of a row of choices, drawn as a box that fills in when chosen. A radio
 * button or a checkbox underneath, so it posts like one and works with no
 * script. Put several in a `ChoiceGroup`.
 */
export function Choice(props: {
  name: string
  value: string
  checked?: boolean
  radio?: boolean
  children: JSX.Element
}) {
  return (
    <label class="relative inline-flex h-[38px] cursor-pointer items-center border border-line-strong px-3.5 text-sm font-medium text-fg-2 hover:border-steel hover:text-fg has-checked:border-accent has-checked:bg-accent/12 has-checked:text-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
      <input
        type={props.radio ? 'radio' : 'checkbox'}
        name={props.name}
        value={props.value}
        checked={props.checked}
        class="sr-only"
      />
      {props.children}
    </label>
  )
}
