import { type JSX, Show } from 'solid-js'

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
  const error = () => props.errors?.[props.name]
  return (
    <div class="grid gap-1.5">
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
      <Show when={error()}>
        {(message) => (
          <p class="text-[13px] text-danger" role="alert">
            {message()}
          </p>
        )}
      </Show>
    </div>
  )
}
