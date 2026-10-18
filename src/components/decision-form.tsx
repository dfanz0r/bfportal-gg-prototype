import { useNavigate } from '@tanstack/solid-router'
import { createEffect, createSignal, For, Show } from 'solid-js'

import {
  CHANGED_SINCE_OPENED,
  type DecisionProblem,
  MAX_NOTE,
  NOTE_NEEDED,
} from '../shared/decision'
import type { Refusal } from '../shared/results'
import { FieldError } from './field-error'
import { Icon } from './icon'
import { buttonAccent, buttonGhost, field, label, panel } from './ui'

/** A server function that decides on one kind of submission. */
type Decide = ((input: {
  data: {
    id: number
    approve: boolean
    note: string
    version: number | undefined
  }
}) => Promise<{ ok: true } | Refusal>) & { url: string }

/**
 * A moderator's decision on a waiting submission: a note to its creator,
 * approve, or request changes. A form posted to the function the script
 * calls, so it works before the page's script has loaded. Refused with no
 * script, the page comes back with `problem` and the note as written.
 */
export function DecisionForm(props: {
  decide: Decide
  id: number
  /**
   * The version of it the page shows, for what its owner can change while it
   * waits. A decision on a version that has moved on is refused.
   */
  version?: number
  /** The page the decision is made on, to come back to if it is refused. */
  back: string
  problem?: DecisionProblem
  note?: string
  /** Notes written often, to start one from. */
  quickNotes?: readonly string[]
  /** What deciding does, said under the buttons. */
  hint: string
}) {
  const navigate = useNavigate()
  const [note, setNote] = createSignal('')
  const [error, setError] = createSignal<string>()
  // What a refused decision posted with no script brought back.
  createEffect(() => {
    setNote(props.note ?? '')
    setError(
      props.problem === 'changed'
        ? CHANGED_SINCE_OPENED
        : props.problem
          ? NOTE_NEEDED
          : undefined,
    )
  })
  const [sending, setSending] = createSignal(false)

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (sending()) return
    const button = event.submitter as HTMLButtonElement | null
    setSending(true)
    let result: Awaited<ReturnType<Decide>>
    try {
      result = await props.decide({
        data: {
          id: props.id,
          approve: button?.value === 'true',
          note: note(),
          version: props.version,
        },
      })
    } catch {
      // No answer came back, which does not say the request never arrived.
      setError(
        'Something went wrong before an answer came back, so this may or may not have been decided. Look at the queue: if it is still there, it was not.',
      )
      setSending(false)
      return
    }
    if (result.ok) {
      // It is decided. Whatever happens now, it must not read as a failure.
      try {
        await navigate({ to: '/admin' })
      } catch {
        window.location.assign('/admin')
      }
      return
    }
    setSending(false)
    if (result.reason === 'signed-out') {
      window.location.assign('/login')
    } else if (result.reason === 'invalid') {
      setError(
        result.errors?.note ??
          result.errors?.form ??
          'That could not be decided.',
      )
    } else if (result.reason === 'forbidden') {
      setError('Your account may no longer decide submissions.')
    } else {
      setError(
        'This is no longer waiting. Someone may have decided it already.',
      )
    }
  }

  return (
    <form
      method="post"
      action={props.decide.url}
      onSubmit={submit}
      class={`${panel} grid gap-3 p-5`}
    >
      <h2 class={label}>Decision</h2>
      <input type="hidden" name="id" value={props.id} />
      <Show when={props.version}>
        {(version) => <input type="hidden" name="version" value={version()} />}
      </Show>
      <input type="hidden" name="back" value={props.back} />
      <label for="note" class="text-sm font-semibold">
        Note to the creator
      </label>
      <textarea
        id="note"
        name="note"
        rows={3}
        maxlength={MAX_NOTE}
        value={note()}
        onInput={(event) => setNote(event.currentTarget.value)}
        class={field}
      >
        {/* The server writes a box's text, not its value. */}
        {props.note ?? ''}
      </textarea>
      <Show when={props.quickNotes}>
        {(quickNotes) => (
          <ul class="flex flex-wrap gap-1.5">
            <For each={quickNotes()}>
              {(quick) => (
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      setNote((written) =>
                        written.trim() ? `${written.trim()} ${quick}` : quick,
                      )
                    }
                    class="border border-line px-2 py-1 text-left text-xs text-fg-2 hover:border-steel hover:text-fg"
                  >
                    {quick}
                  </button>
                </li>
              )}
            </For>
          </ul>
        )}
      </Show>
      <FieldError message={error()} />
      <div class="flex flex-wrap gap-2">
        <button
          type="submit"
          name="approve"
          value="true"
          disabled={sending()}
          class={buttonAccent}
        >
          <Icon name="check" />
          Approve
        </button>
        <button
          type="submit"
          name="approve"
          value="false"
          disabled={sending()}
          class={buttonGhost}
        >
          Request changes
        </button>
      </div>
      <p class="text-[13px] text-fg-3">{props.hint}</p>
    </form>
  )
}
