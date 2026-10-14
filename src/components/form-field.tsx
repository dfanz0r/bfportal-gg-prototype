import { type JSX, Show } from 'solid-js'

import { FieldError } from './field-error'

/**
 * One field of a form: its label, a hint, the field itself, and what is wrong
 * with it if the server said so. `name` matches the field's `name`, so the
 * error for it can be found.
 */
export function FormField(props: {
  label: string
  name: string
  hint?: string
  optional?: boolean
  errors?: Record<string, string>
  children: JSX.Element
}) {
  return (
    // Packed to the top: beside a taller field in a row, the spare height
    // must not be shared out between the label, the box and the hint.
    <div class="grid content-start gap-1.5">
      <label for={props.name} class="text-sm font-semibold">
        {props.label}
        <Show when={props.optional}>
          <span class="ml-2 font-normal text-fg-3">Optional</span>
        </Show>
      </label>
      {props.children}
      <Show when={props.hint}>
        <p class="text-[13px] text-fg-3">{props.hint}</p>
      </Show>
      <FieldError message={props.errors?.[props.name]} />
    </div>
  )
}
