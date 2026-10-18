import { useNavigate } from '@tanstack/solid-router'
import { createEffect, createSignal, For, Show } from 'solid-js'

import type { SnippetSubmitPageData } from '../functions/submit-snippet'
import { submitSnippetForReview } from '../functions/submit-snippet'
import { formFields } from '../shared/form-input'
import { gameList } from '../shared/games'
import { MAX_SNIPPET_LINES } from '../shared/snippet-form'
import { submitLead } from '../shared/submit'
import { Choice } from './choice'
import { ChoiceGroup } from './choice-group'
import { CodeInput } from './code-input'
import { FieldError } from './field-error'
import { FormField } from './form-field'
import { FormSection } from './form-section'
import { Icon } from './icon'
import { PageLayout } from './page-layout'
import { SubmitStart } from './submit-start'
import { buttonAccent, buttonGhost, field, label, panel } from './ui'

const RULES = [
  'Keep it small and reusable. A whole experience should be submitted as an experience.',
  "It must be your own work, or shared with its author's permission.",
  'Submit each snippet once. If you change it later, edit its page instead of submitting it again.',
]

/**
 * The page for sharing a snippet. Its top is the experience form's, word for
 * word: the head, the game, what is being shared. Only what is below differs,
 * so going between the two moves nothing above.
 */
export function SnippetSubmitPage(props: { data: SnippetSubmitPageData }) {
  const data = () => props.data
  const navigate = useNavigate()
  // The game snippets are for. Choosing any other on this form goes to its
  // experience form: it has no snippets to submit.
  const game = () => gameList.find((item) => item.snippets === true)
  // A form that was posted with no script and refused comes back as a draft.
  const draft = () => data().draft
  // Whether anything has been typed in, which going to the experience form
  // would lose.
  const [typedIn, setTypedIn] = createSignal(false)
  const [errors, setErrors] = createSignal<Record<string, string>>(
    // Read once on purpose, so the server's HTML carries them too.
    props.data.draft?.errors ?? {},
  )
  createEffect(() => setErrors(draft()?.errors ?? {}))
  const [sending, setSending] = createSignal(false)
  const [reading, setReading] = createSignal(false)
  const start = (name: string) => {
    const value = draft()?.fields[name]
    return typeof value === 'string' ? value : ''
  }

  // One of theirs being changed, rather than a new snippet.
  const editing = () => data().editing
  const sentBack = () => editing()?.status === 'changes_requested'
  const inReview = () => editing()?.status === 'pending'
  const live = () => editing()?.status === 'published'
  const lead = () => {
    if (sentBack()) {
      return 'Changes were requested. Fix what the note says and resubmit it.'
    }
    if (inReview()) {
      return 'In review. Resubmit it and the moderator reviews the new version.'
    }
    if (live()) {
      return editing()?.editWaiting
        ? 'Live. Your changes are waiting for a moderator. Send more and they are reviewed together.'
        : 'Live. Changes you send are reviewed before they show on its page.'
    }
    return submitLead
  }

  const fail = (form: HTMLFormElement, problems: Record<string, string>) => {
    setErrors(problems)
    setSending(false)
    form.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center' })
  }

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    // A file still being read into the box is the snippet, and the box does
    // not hold it yet.
    if (sending() || reading()) return
    const form = event.currentTarget as HTMLFormElement
    setSending(true)
    // The box holds the snippet; a file read into it is not sent as well.
    const fields = formFields(new FormData(form))
    delete fields.file
    let result: Awaited<ReturnType<typeof submitSnippetForReview>>
    try {
      result = await submitSnippetForReview({ data: fields })
    } catch {
      // No answer came back, which does not say the request never arrived.
      fail(form, {
        form: 'Something went wrong before an answer came back, so this may or may not have been submitted. You can send it again: if both went through, a moderator will see they are the same.',
      })
      return
    }
    if (result.ok) {
      // It is in. Whatever happens now, it must not read as a failure.
      const page = `/snippets/${result.slug}`
      try {
        await navigate({ href: page })
      } catch {
        window.location.assign(page)
      }
    } else if (result.reason === 'signed-out') {
      window.location.assign('/login')
    } else {
      fail(form, result.errors ?? { form: 'That could not be submitted.' })
    }
  }

  return (
    <PageLayout
      title={editing()?.title ?? 'Submit'}
      lead={lead()}
      crumbs={
        editing()
          ? [
              { label: 'Your submissions', href: '/submissions' },
              { label: sentBack() ? 'Fix and resubmit' : 'Edit' },
            ]
          : undefined
      }
    >
      <div
        class="grid items-start gap-8 min-[1100px]:grid-cols-[minmax(0,1fr)_348px] min-[1100px]:gap-10"
        data-game={game()?.id}
      >
        <div class="min-w-0">
          {/* What the moderator wrote, headed by what it is, never by who
              wrote it. */}
          <Show when={editing()?.reviewNote}>
            {(note) => (
              <div class="mb-8 grid gap-1 border-l-2 border-warn bg-warn/8 px-4 py-3 text-sm text-fg-2">
                <b class="font-semibold text-fg">Moderator note</b>
                <p class="whitespace-pre-line">{note()}</p>
              </div>
            )}
          </Show>
          {/* What is being shared was settled when it was first sent. */}
          <Show when={!editing() && game()}>
            {(current) => (
              <SubmitStart
                game={current().id}
                kind="snippet"
                filledIn={() => typedIn() || draft() !== null}
              />
            )}
          </Show>

          <form
            method="post"
            enctype="multipart/form-data"
            action={submitSnippetForReview.url}
            onSubmit={submit}
            onInput={() => setTypedIn(true)}
          >
            <Show when={editing()}>
              {(sent) => (
                <input type="hidden" name="editing" value={sent().slug} />
              )}
            </Show>
            <Show when={errors().form}>
              {(message) => (
                <p
                  class="mb-8 border-l-2 border-danger bg-danger/8 px-4 py-3 text-sm text-fg"
                  role="alert"
                >
                  {message()}
                </p>
              )}
            </Show>

            <FormSection title="Your snippet">
              <FormField label="Title" name="title" errors={errors()}>
                <input
                  id="title"
                  name="title"
                  required
                  minlength={3}
                  maxlength={80}
                  value={start('title')}
                  class={field}
                />
              </FormField>
              <FormField
                label="Description"
                name="description"
                hint="Explain what the snippet does and how to use it. Markdown is supported."
                errors={errors()}
              >
                <textarea
                  id="description"
                  name="description"
                  rows={4}
                  maxlength={10000}
                  class={field}
                >
                  {start('description')}
                </textarea>
              </FormField>
              <div class="grid content-start gap-1.5">
                <label for="script" class="text-sm font-semibold">
                  Snippet
                </label>
                <CodeInput
                  id="script"
                  name="script"
                  value={start('script')}
                  maxLines={MAX_SNIPPET_LINES}
                  onReading={setReading}
                />
                <p class="text-[13px] text-fg-3">
                  Snippets are small, reusable bits of script. To share a whole
                  experience, submit it as an experience instead.
                </p>
                <FieldError message={errors().script} />
              </div>
              <ChoiceGroup
                label="Category"
                hint="One category: where someone would look for it."
                error={errors().category}
              >
                <For each={data().options.categories}>
                  {(category, index) => (
                    <Choice
                      radio
                      name="category"
                      value={category.slug}
                      checked={
                        draft()
                          ? start('category') === category.slug
                          : index() === 0
                      }
                    >
                      {category.name}
                    </Choice>
                  )}
                </For>
              </ChoiceGroup>
              {/* Not asked for: a game only runs its latest release. */}
              <Show when={data().options.currentSdk}>
                {(sdk) => (
                  <p class="flex items-center gap-2 text-[13px] text-fg-3">
                    <Icon name="check" class="size-3.5 text-fg" />
                    It will be listed for Portal SDK {sdk().version}, the
                    current release.
                  </p>
                )}
              </Show>
            </FormSection>

            <div class="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-6">
              <button
                type="submit"
                class={`${buttonAccent} h-11 px-6`}
                disabled={sending() || reading()}
              >
                {sending()
                  ? 'Submitting'
                  : sentBack() || inReview()
                    ? 'Resubmit'
                    : live()
                      ? 'Submit changes'
                      : 'Submit for review'}
                <Icon name="arrow-right" />
              </button>
              <a
                href={editing() ? `/snippets/${editing()?.slug}` : '/snippets'}
                class={`${buttonGhost} h-11 px-6`}
              >
                Cancel
              </a>
              <p class="max-w-[34em] text-[13.5px] text-fg-3">
                {live()
                  ? 'Its page stays as it is until a moderator approves the changes.'
                  : 'Nothing is public until a moderator approves it.'}
              </p>
            </div>
          </form>
        </div>

        <aside class="grid gap-4 min-[1100px]:sticky min-[1100px]:top-20">
          <div class={`${panel} p-5`}>
            <h2 class={`${label} mb-3`}>Before you submit</h2>
            <ul class="grid gap-2">
              <For each={RULES}>
                {(rule) => (
                  <li class="relative pl-[18px] text-[13.5px] text-fg-2 before:absolute before:top-2 before:left-0 before:size-1.5 before:bg-accent">
                    {rule}
                  </li>
                )}
              </For>
            </ul>
          </div>
        </aside>
      </div>
    </PageLayout>
  )
}
