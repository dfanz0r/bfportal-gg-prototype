import { useRouter } from '@tanstack/solid-router'
import { createSignal, Show } from 'solid-js'

import { setTemplateOffer } from '../functions/experience'
import { FieldError } from './field-error'
import { buttonGhost } from './ui'

/**
 * For an experience's owner, above its files: whether they are offered as a
 * template, and the button that changes it. Taking the offer back is
 * immediate. Offering files on a published experience asks a moderator
 * first; until then the button takes the request back.
 *
 * A form posted to the function the script calls, so it works before the
 * page's script has loaded.
 */
export function TemplateOffer(props: {
  slug: string
  isTemplate: boolean
  published: boolean
  /** Waiting for its review, when its files are not offered until after. */
  inReview: boolean
  request: { waiting: boolean; note: string | null } | null
}) {
  const router = useRouter()
  const [sending, setSending] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const waiting = () => props.request?.waiting === true
  // Pressing it offers the files, unless they are offered or asked for.
  const offer = () => !props.isTemplate && !waiting()

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (sending()) return
    setSending(true)
    setError(undefined)
    try {
      const result = await setTemplateOffer({
        data: { slug: props.slug, offer: offer() },
      })
      if (result.ok) {
        await router.invalidate()
      } else if (result.reason === 'signed-out') {
        window.location.assign('/login')
      } else {
        setError(result.errors?.form ?? 'That could not be changed.')
      }
    } catch {
      setError(
        'No answer came back, so this may or may not have changed. Reload the page to see.',
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      method="post"
      action={setTemplateOffer.url}
      onSubmit={submit}
      class="mb-4 grid gap-2 border-l-2 border-steel bg-steel/8 px-4 py-3.5 text-sm text-fg-2"
    >
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="offer" value={String(offer())} />
      <input type="hidden" name="back" value={`/experiences/${props.slug}`} />
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p class="min-w-0 flex-1 basis-64">
          <Show
            when={!props.isTemplate}
            fallback={
              <>
                <b class="font-semibold text-fg">Offered as a template.</b>{' '}
                Anyone can download these files.
              </>
            }
          >
            <Show
              when={waiting()}
              fallback={
                <>
                  <b class="font-semibold text-fg">Not a template.</b> Only you
                  and the moderators can download these files.
                  <Show when={props.published}>
                    {' '}
                    A moderator approves offering them.
                  </Show>
                  <Show when={props.inReview}>
                    {' '}
                    They can be offered once its review is decided.
                  </Show>
                </>
              }
            >
              <b class="font-semibold text-fg">Waiting for a moderator.</b> You
              asked to offer these files as a template.
            </Show>
          </Show>
        </p>
        {/* In review, files can stop being offered, but not start. */}
        <Show when={props.isTemplate || !props.inReview}>
          <button
            type="submit"
            disabled={sending()}
            class={`${buttonGhost} h-[34px] px-3 text-xs`}
          >
            {props.isTemplate
              ? 'Stop offering'
              : waiting()
                ? 'Cancel request'
                : 'Offer as a template'}
          </button>
        </Show>
      </div>
      {/* Headed by what it is, never by who wrote it. */}
      <Show when={!props.isTemplate && props.request?.note}>
        {(note) => <p>Moderator note: {note()}</p>}
      </Show>
      <FieldError message={error()} />
    </form>
  )
}
