import { Show } from 'solid-js'

/** What is wrong with a field, under it. Nothing when nothing is. */
export function FieldError(props: { message?: string }) {
  return (
    <Show when={props.message}>
      {(message) => (
        <p class="text-[13px] text-danger" role="alert">
          {message()}
        </p>
      )}
    </Show>
  )
}
