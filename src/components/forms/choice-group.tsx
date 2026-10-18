import { type JSX, Show } from 'solid-js'

import { FieldError } from './field-error'

/**
 * A named row of `Choice`s: what is being chosen, the choices, a hint and
 * what is wrong with the choice if the server said so.
 */
export function ChoiceGroup(props: {
  label: string
  optional?: boolean
  hint?: string
  error?: string
  children: JSX.Element
}) {
  return (
    <fieldset class="grid min-w-0 gap-1.5">
      <legend class="mb-1.5 text-sm font-semibold">
        {props.label}
        <Show when={props.optional}>
          <span class="ml-2 font-normal text-fg-3">Optional</span>
        </Show>
      </legend>
      <div class="flex flex-wrap gap-1.5">{props.children}</div>
      <Show when={props.hint}>
        <p class="text-[13px] text-fg-3">{props.hint}</p>
      </Show>
      <FieldError message={props.error} />
    </fieldset>
  )
}
