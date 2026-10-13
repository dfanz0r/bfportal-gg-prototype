import { Link, useNavigate } from '@tanstack/solid-router'
import { createSignal, For, type JSX, Show } from 'solid-js'

import { decide, type SubmissionReview } from '../functions/moderation'
import { experienceTypeLabels } from '../shared/content'
import { gameInfo } from '../shared/games'
import { Avatar } from './avatar'
import { DateText } from './date-text'
import { Fact } from './fact'
import { Facts } from './facts'
import { Icon } from './icon'
import { PageLayout } from './page-layout'
import { buttonAccent, buttonGhost, field, label, panel } from './ui'

/** One line of the checks: something to look at, or something that is fine. */
function Check(props: { warn?: boolean; children: JSX.Element }) {
  return (
    <li class="flex gap-2.5 text-sm">
      <Icon
        name={props.warn ? 'alert' : 'check'}
        class={`mt-0.5 size-4 ${props.warn ? 'text-warn' : 'text-fg-3'}`}
      />
      <span class={props.warn ? 'text-fg' : 'text-fg-2'}>{props.children}</span>
    </li>
  )
}

/** Reviewing one submission: what it is, what to check, and the decision. */
export function AdminReview(props: { data: SubmissionReview }) {
  const data = () => props.data
  const submission = () => data().submission
  const checks = () => data().checks
  const navigate = useNavigate()
  const [error, setError] = createSignal<string>()
  const [sending, setSending] = createSignal(false)

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    const button = event.submitter as HTMLButtonElement | null
    setSending(true)
    try {
      const result = await decide({
        data: {
          id: submission().id,
          approve: button?.value === 'true',
          note: String(new FormData(form).get('note') ?? ''),
        },
      })
      if (result.ok) {
        await navigate({ to: '/admin' })
      } else if (result.reason === 'invalid') {
        setError(result.errors?.note ?? 'That could not be decided.')
      } else {
        setError(
          'This is no longer waiting. Someone may have decided it already.',
        )
      }
    } catch {
      setError('Something went wrong. Nothing was decided.')
    } finally {
      setSending(false)
    }
  }

  return (
    <PageLayout
      title={submission().title}
      lead={`A new ${gameInfo(submission().game).name} submission.`}
      actions={
        <>
          <a href={`/experiences/${submission().slug}`} class={buttonGhost}>
            See its page
          </a>
          <Link to="/admin" class={buttonGhost}>
            Back to the queue
          </Link>
        </>
      }
    >
      <div
        class="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_380px] min-[1100px]:gap-10"
        data-game={submission().game}
      >
        <div class="grid min-w-0 gap-6">
          <Show when={submission().coverImgUrl}>
            {(cover) => (
              <img
                src={cover()}
                alt=""
                referrerpolicy="no-referrer"
                class="aspect-video w-full max-w-xl border border-line object-cover"
              />
            )}
          </Show>
          <Facts>
            <Fact name="Category">{submission().category}</Fact>
            <Fact name="Code">
              <span class="font-mono tracking-[0.12em] uppercase">
                {submission().code ?? 'None'}
              </span>
            </Fact>
            <Fact name="Lobby size">
              Up to {submission().maxPlayers} players
            </Fact>
            <Fact name="Bots">{submission().maxBots || 'None'}</Fact>
            <Show when={submission().types.length > 0}>
              <Fact name="Built with">
                {submission()
                  .types.map((type) => experienceTypeLabels[type])
                  .join(', ')}
              </Fact>
            </Show>
            <Fact name="Template">
              {submission().isTemplate ? 'Yes' : 'No'}
            </Fact>
            <Fact name="Submitted">
              <DateText value={submission().submittedAt} now={data().now} />
            </Fact>
          </Facts>
          <div>
            <h2 class={`${label} mb-2`}>Description</h2>
            <Show
              when={submission().descriptionHtml}
              fallback={<p class="text-sm text-fg-3">None.</p>}
            >
              {/* Rendered and sanitized from Markdown when it was saved. */}
              <div class="prose" innerHTML={submission().descriptionHtml} />
            </Show>
          </div>
          <For
            each={[
              ['Video', submission().vidUrl],
              ['Repository', submission().repoUrl],
              ['Larger files', submission().filesUrl],
            ].filter(([, url]) => url)}
          >
            {([name, url]) => (
              <p class="text-sm">
                <span class="text-fg-3">{name}: </span>
                <a
                  href={url ?? ''}
                  rel="noopener noreferrer"
                  class="text-steel-hi underline [overflow-wrap:anywhere]"
                >
                  {url}
                </a>
              </p>
            )}
          </For>
        </div>

        <aside class="grid gap-4">
          <div class={`${panel} p-5`}>
            <h2 class={`${label} mb-3`}>Checks</h2>
            <ul class="grid gap-2.5">
              <Check
                warn={
                  checks().portal === 'missing' ||
                  checks().portal === 'unpublished'
                }
              >
                {
                  {
                    published: 'The code is published on Portal.',
                    unpublished: 'Portal says the code is not published.',
                    missing: 'Portal has no experience with this code.',
                    unavailable:
                      'gametools did not answer, so the code was not checked.',
                    'no-code': 'No code: a template shared as files.',
                  }[checks().portal]
                }
              </Check>
              <Show when={checks().portalTitle}>
                {(title) => <Check warn>Portal calls it “{title()}”.</Check>}
              </Show>
              <Show
                when={checks().sameCode.length > 0}
                fallback={
                  <Show when={submission().code}>
                    <Check>No other page uses this code.</Check>
                  </Show>
                }
              >
                <Check warn>
                  This code is already on{' '}
                  <For each={checks().sameCode}>
                    {(other, index) => (
                      <>
                        {index() > 0 ? ', ' : ''}
                        <a
                          href={`/experiences/${other.slug}`}
                          class="underline"
                        >
                          {other.title}
                        </a>{' '}
                        ({other.status})
                      </>
                    )}
                  </For>
                  .
                </Check>
              </Show>
              <Show when={checks().pictureHosts.length > 0}>
                <Check warn>
                  Loads pictures from {checks().pictureHosts.join(', ')}.
                  Whoever runs a host sees who opens the page.
                </Check>
              </Show>
              <Show when={!checks().hasCover}>
                <Check warn>It has no cover picture.</Check>
              </Show>
              <Show when={checks().thinDescription}>
                <Check warn>The description is a sentence or less.</Check>
              </Show>
            </ul>
          </div>

          <form
            method="post"
            action={decide.url}
            onSubmit={submit}
            class={`${panel} grid gap-3 p-5`}
          >
            <h2 class={label}>Decision</h2>
            <input type="hidden" name="id" value={submission().id} />
            <label for="note" class="text-sm font-semibold">
              Note to the creator
            </label>
            <textarea
              id="note"
              name="note"
              rows={3}
              maxlength={1000}
              class={field}
            />
            <Show when={error()}>
              {(message) => (
                <p class="text-[13px] text-danger" role="alert">
                  {message()}
                </p>
              )}
            </Show>
            <div class="flex flex-wrap gap-2">
              <button
                type="submit"
                name="approve"
                value="true"
                disabled={sending()}
                class={buttonAccent}
              >
                Approve
              </button>
              <button
                type="submit"
                name="approve"
                value="false"
                disabled={sending()}
                class={buttonGhost}
              >
                Turn down
              </button>
            </div>
            <p class="text-[13px] text-fg-3">
              Approving publishes the page. Turning it down needs a note.
            </p>
          </form>

          <div class={`${panel} grid gap-3 p-5`}>
            <h2 class={label}>Submitter</h2>
            <p class="flex items-center gap-2.5 text-sm font-medium">
              <Avatar
                name={data().submitter.name}
                image={data().submitter.image}
                class="size-7 text-[10px]"
              />
              <Link
                to="/users/$discordId"
                params={{ discordId: data().submitter.discordId }}
                class="hover:underline"
              >
                {data().submitter.name}
              </Link>
            </p>
            <p class="text-sm text-fg-2">
              Joined <DateText value={data().submitter.joinedAt} />.{' '}
              {data().submitter.published} published before,{' '}
              {data().submitter.rejected} turned down.
            </p>
          </div>
        </aside>
      </div>
    </PageLayout>
  )
}
