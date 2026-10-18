import { useLocation, useRouter } from '@tanstack/solid-router'
import { createSignal, type JSX } from 'solid-js'

import { formFields } from '../../shared/form-input'
import { FieldError } from '../forms/field-error'

type Answer = {
  ok: boolean
  reason?: string
  errors?: Record<string, string>
}

/** A server function a form posts to: `formOr` on its validator. */
type Action = ((options: { data: never }) => Promise<Answer>) & {
  url: string
}

/** Why a refusal was made, in words, when no field says. */
const reasons: Record<string, string> = {
  forbidden: 'Only an admin can do that.',
  'not-found': 'It has changed since this page loaded. Reload to see it now.',
}

/**
 * A form that changes something. It posts to its function's address, and
 * comes back to this page; with the script, it calls the function instead
 * and loads the page's data again. Nothing else happens while it is out, and
 * what came back is said under it: a refusal and why, or that no answer came.
 */
export function PostForm(props: {
  action: Action
  class?: string
  /** For a form that adds something: empty it once it is added. */
  reset?: boolean
  'aria-label'?: string
  children: JSX.Element
}) {
  const router = useRouter()
  const location = useLocation()
  const [sending, setSending] = createSignal(false)
  const [error, setError] = createSignal<string>()

  const send = async (
    event: SubmitEvent & { currentTarget: HTMLFormElement },
  ) => {
    event.preventDefault()
    if (sending()) return
    const form = event.currentTarget
    // With the button pressed, for forms whose buttons carry a value.
    const fields = formFields(new FormData(form, event.submitter))
    setSending(true)
    setError(undefined)
    let result: Answer
    try {
      result = await props.action({ data: fields as never })
    } catch {
      setError(
        'No answer came back, so this may or may not have been done. Reload the page to see.',
      )
      setSending(false)
      return
    }
    if (result.ok) {
      if (props.reset) form.reset()
      // It is done. A page that then fails to load is never reported as the
      // action failing.
      try {
        await router.invalidate()
      } catch {
        window.location.reload()
      }
    } else if (result.reason === 'signed-out') {
      window.location.assign('/login')
    } else {
      setError(
        result.errors?.form ??
          Object.values(result.errors ?? {})[0] ??
          reasons[result.reason ?? ''] ??
          'That could not be done.',
      )
    }
    setSending(false)
  }

  return (
    <form
      method="post"
      action={props.action.url}
      onSubmit={send}
      aria-label={props['aria-label']}
      aria-busy={sending()}
      class={props.class}
    >
      <input type="hidden" name="back" value={location().href} />
      {props.children}
      <FieldError message={error()} />
    </form>
  )
}
