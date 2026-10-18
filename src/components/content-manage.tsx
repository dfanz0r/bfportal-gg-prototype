import { useNavigate, useRouter } from '@tanstack/solid-router'
import { createSignal, type JSX, Show } from 'solid-js'

import {
  deleteExperience,
  removeExperienceForGood,
} from '../functions/experience'
import { deleteSnippet, removeSnippetForGood } from '../functions/snippets'
import type { ContentStatus } from '../shared/content'
import { MAX_NOTE } from '../shared/decision'
import { FieldError } from './field-error'
import { Icon } from './icon'
import { buttonDanger, field, label, panel } from './ui'

const danger = `${buttonDanger} h-[34px] px-3 text-xs`

/** What can be ended, where its page is, and the functions that end it. */
const KINDS = {
  experience: {
    path: '/experiences',
    remove: deleteExperience,
    removeForGood: removeExperienceForGood,
  },
  snippet: {
    path: '/snippets',
    remove: deleteSnippet,
    removeForGood: removeSnippetForGood,
  },
}

/** One action, closed until it is opened: nothing ends by a stray press. */
function Action(props: { title: string; children: JSX.Element }) {
  return (
    <details class="group border-t border-line pt-3 first-of-type:border-t-0 first-of-type:pt-0">
      <summary class="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-danger">
        {props.title}
        <Icon
          name="chevron-down"
          class="size-4 transition-transform group-open:rotate-180"
        />
      </summary>
      <div class="mt-3">{props.children}</div>
    </details>
  )
}

/**
 * Ending an experience or a snippet, at the foot of its page: its owner
 * deleting it, and a moderator removing it for good with a note. Each is a
 * form posted to the function the script calls, so it works before the
 * script has loaded, and each asks to be meant: a box ticked, or a note
 * written.
 */
export function ContentManage(props: {
  kind: keyof typeof KINDS
  slug: string
  status: ContentStatus
  isOwner: boolean
  isStaff: boolean
}) {
  const navigate = useNavigate()
  const router = useRouter()
  const [sending, setSending] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const ends = () => KINDS[props.kind]
  const back = () => `${ends().path}/${props.slug}`
  // A draft has been sent to nobody, and one removed is ended already.
  const removable = () =>
    props.isStaff && props.status !== 'draft' && props.status !== 'removed'

  const send = async (
    event: SubmitEvent,
    act: () => Promise<{
      ok: boolean
      reason?: string
      errors?: Record<string, string>
    }>,
    done: () => Promise<unknown>,
    /** Where to go once it is done, loaded whole if `done` fails. */
    address: string,
  ) => {
    event.preventDefault()
    if (sending()) return
    setSending(true)
    setError(undefined)
    let result: Awaited<ReturnType<typeof act>>
    try {
      result = await act()
    } catch {
      setError(
        'No answer came back, so this may or may not have been done. Reload the page to see.',
      )
      setSending(false)
      return
    }
    if (result.ok) {
      // It is done. A page that then fails to load is never reported as
      // the action failing.
      try {
        await done()
      } catch {
        window.location.assign(address)
      }
    } else if (result.reason === 'signed-out') {
      window.location.assign('/login')
    } else {
      setError(result.errors?.note ?? 'That could not be done.')
    }
    setSending(false)
  }

  return (
    <Show when={props.isOwner || removable()}>
      <div class={`${panel} grid gap-3 p-5`}>
        <h2 class={label}>Manage</h2>
        <Show when={props.isOwner}>
          <Action title={`Delete this ${props.kind}`}>
            <form
              method="post"
              action={ends().remove.url}
              onSubmit={(event) =>
                send(
                  event,
                  () => ends().remove({ data: { slug: props.slug } }),
                  () => navigate({ to: '/submissions' }),
                  '/submissions',
                )
              }
              class="grid gap-3"
            >
              <input type="hidden" name="slug" value={props.slug} />
              <input type="hidden" name="back" value={back()} />
              <p class="text-[13px] text-fg-2">
                It goes from the site for good: from listings, from its address
                and from your submissions. Its likes and updates go with it.
              </p>
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" required class="accent-current" />
                Yes, delete it
              </label>
              <div>
                <button type="submit" disabled={sending()} class={danger}>
                  Delete
                </button>
              </div>
            </form>
          </Action>
        </Show>
        <Show when={removable()}>
          <Action title="Remove for good">
            <form
              method="post"
              action={ends().removeForGood.url}
              onSubmit={(event) => {
                const note = new FormData(
                  event.currentTarget as HTMLFormElement,
                ).get('note')
                return send(
                  event,
                  () =>
                    ends().removeForGood({
                      data: { slug: props.slug, note: String(note ?? '') },
                    }),
                  () => router.invalidate(),
                  back(),
                )
              }}
              class="grid gap-3"
            >
              <input type="hidden" name="slug" value={props.slug} />
              <input type="hidden" name="back" value={back()} />
              <p class="text-[13px] text-fg-2">
                For spam or something badly wrong. It is taken off the site and
                cannot be sent in again. Its creator sees the note.
              </p>
              <label for="remove-note" class="text-sm font-semibold">
                Note to the creator
              </label>
              <textarea
                id="remove-note"
                name="note"
                rows={3}
                required
                minlength={3}
                maxlength={MAX_NOTE}
                class={field}
              />
              <div>
                <button type="submit" disabled={sending()} class={danger}>
                  Remove
                </button>
              </div>
            </form>
          </Action>
        </Show>
        <FieldError message={error()} />
      </div>
    </Show>
  )
}
