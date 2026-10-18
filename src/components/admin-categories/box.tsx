import type { JSX } from 'solid-js'

/** A setting of a row that is on or off. */
export function Box(props: {
  name: string
  checked: boolean
  children: JSX.Element
}) {
  return (
    <label class="inline-flex items-center gap-1.5 text-[13.5px] whitespace-nowrap text-fg-2 has-checked:text-fg">
      <input
        type="checkbox"
        name={props.name}
        value="true"
        checked={props.checked}
        class="accent-current"
      />
      {props.children}
    </label>
  )
}
