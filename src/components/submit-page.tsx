import { useNavigate } from '@tanstack/solid-router'
import { createSignal, For, Show } from 'solid-js'

import type { SubmitPageData } from '../functions/submit'
import { submitForReview } from '../functions/submit'
import { experienceTypeLabels } from '../shared/content'
import { MAX_CREDITS, MAX_IMAGES } from '../shared/experience-form'
import { formFields } from '../shared/form-input'
import { gameInfo, gameList } from '../shared/games'
import { Check } from './check'
import { FormField } from './form-field'
import { PageLayout } from './page-layout'
import { Section } from './section'
import { body, buttonAccent, buttonSteel, field, label, panel } from './ui'

const LEAD =
  'Share something you built in Portal. A moderator looks at every submission before it appears.'

/** What Portal said about the code, in a sentence. */
function LookupNote(props: { data: SubmitPageData }) {
  const data = () => props.data
  return (
    <Show
      when={data().found}
      fallback={
        <Show when={data().lookup === 'missing' || data().unreadable}>
          <p class="border-l-2 border-warn bg-warn/8 px-4 py-3 text-sm text-fg-2">
            <Show
              when={data().unreadable}
              fallback="Portal has no experience with this code. Check it and try again."
            >
              That does not look like a {gameInfo(data().game).name} experience
              code or a link to one.
            </Show>
          </p>
        </Show>
      }
    >
      {(found) => (
        <div class={`${panel} flex flex-wrap items-center gap-4 p-4`}>
          <Show when={found().thumbnailUrl}>
            {(thumbnail) => (
              <img
                src={thumbnail()}
                alt=""
                referrerpolicy="no-referrer"
                class="aspect-video w-36 shrink-0 object-cover"
              />
            )}
          </Show>
          <div class="min-w-0 text-sm text-fg-2">
            <p class={label}>Found on Portal</p>
            <p class="mt-1 text-[15px] font-semibold text-fg">
              {found().title}
            </p>
            <p>
              {found().maps.length} {found().maps.length === 1 ? 'map' : 'maps'}
              <Show when={found().players > 0}>
                , up to {found().players} players
              </Show>
              . The form below starts from this; change anything that is wrong.
            </p>
            <Show when={!found().published}>
              <p class="text-warn">Portal says it is not published.</p>
            </Show>
          </div>
        </div>
      )}
    </Show>
  )
}

/** The page for sharing an experience. */
export function SubmitPage(props: { data: SubmitPageData; error?: string }) {
  const data = () => props.data
  const info = () => gameInfo(data().game)
  const navigate = useNavigate()
  const [errors, setErrors] = createSignal<Record<string, string>>({})
  const [sending, setSending] = createSignal(false)
  const portalTags = () => data().found?.tags ?? []

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    setSending(true)
    try {
      const result = await submitForReview({
        data: formFields(new FormData(form)),
      })
      if (result.ok) {
        await navigate({ href: `/experiences/${result.slug}` })
      } else if (result.reason === 'signed-out') {
        window.location.assign('/login')
      } else {
        setErrors(result.errors ?? { form: 'That could not be submitted.' })
        form
          .querySelector('[role="alert"]')
          ?.scrollIntoView({ block: 'center' })
      }
    } catch {
      setErrors({ form: 'Something went wrong. Nothing was submitted.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <PageLayout title="Submit an experience" lead={LEAD}>
      <div class="grid max-w-[52rem] gap-8" data-game={data().game}>
        {/* A GET form: the game and the code go in the address, and the page
            comes back with what Portal says about them. */}
        <form method="get" action="/submit" class={`${panel} grid gap-4 p-5`}>
          <fieldset>
            <legend class={`${label} mb-2`}>Game</legend>
            <div class="flex flex-wrap gap-x-6">
              <For each={gameList}>
                {(game) => (
                  <Check
                    radio
                    name="game"
                    value={game.id}
                    checked={game.id === data().game}
                  >
                    {game.name}
                  </Check>
                )}
              </For>
            </div>
          </fieldset>
          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <FormField label="Experience code" name="lookup-code">
              <input
                id="lookup-code"
                name="code"
                value={data().code ?? ''}
                autocomplete="off"
                spellcheck={false}
                class={`${field} font-mono tracking-[0.12em] uppercase`}
              />
            </FormField>
            <FormField
              label="Or a link to it on Portal"
              name="lookup-link"
              optional
            >
              <input
                id="lookup-link"
                name="link"
                type="url"
                value={data().link ?? ''}
                class={field}
              />
            </FormField>
          </div>
          <div>
            <button type="submit" class={buttonSteel}>
              Fetch details
            </button>
          </div>
        </form>

        <LookupNote data={data()} />

        <form
          method="post"
          action={submitForReview.url}
          onSubmit={submit}
          class="grid gap-6"
        >
          <input type="hidden" name="game" value={data().game} />
          <input type="hidden" name="code" value={data().code ?? ''} />
          <input type="hidden" name="link" value={data().link ?? ''} />

          <Show
            when={
              errors().form ?? errors().code ?? errors().link ?? props.error
            }
          >
            {(message) => (
              <p
                class="border-l-2 border-danger bg-danger/8 px-4 py-3 text-sm text-fg"
                role="alert"
              >
                {message()}
              </p>
            )}
          </Show>
          <Show when={!data().code && !data().link}>
            <p class={`${body} text-sm`}>
              No code yet. Fetch one above, or tick “Offer it as a template” to
              share files without a code.
            </p>
          </Show>

          <FormField label="Title" name="title" errors={errors()}>
            <input
              id="title"
              name="title"
              required
              minlength={3}
              maxlength={80}
              value={data().found?.title ?? ''}
              class={field}
            />
          </FormField>

          <fieldset>
            <legend class="mb-1.5 text-sm font-semibold">Category</legend>
            <div class="flex flex-wrap gap-x-6">
              <For each={data().options.categories}>
                {(category, index) => (
                  <Check
                    radio
                    name="category"
                    value={category.slug}
                    checked={index() === 0}
                  >
                    {category.name}
                  </Check>
                )}
              </For>
            </div>
            <Show when={errors().category}>
              {(message) => (
                <p class="text-[13px] text-danger" role="alert">
                  {message()}
                </p>
              )}
            </Show>
          </fieldset>

          <FormField
            label="Description"
            name="description"
            hint="Markdown works: headings, lists, links and pictures."
            errors={errors()}
          >
            <textarea
              id="description"
              name="description"
              rows={8}
              maxlength={10000}
              class={field}
            >
              {data().found?.description ?? ''}
            </textarea>
          </FormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Players"
              name="maxPlayers"
              hint="The most a match holds."
              errors={errors()}
            >
              <input
                id="maxPlayers"
                name="maxPlayers"
                type="number"
                required
                min={1}
                max={256}
                value={data().found?.players || ''}
                class={field}
              />
            </FormField>
            <FormField label="Bots" name="maxBots" errors={errors()}>
              <input
                id="maxBots"
                name="maxBots"
                type="number"
                min={0}
                max={256}
                value={0}
                class={field}
              />
            </FormField>
          </div>

          <Show when={info().builtWith.length > 0}>
            <fieldset>
              <legend class="mb-1.5 text-sm font-semibold">Built with</legend>
              <div class="flex flex-wrap gap-x-6">
                <For each={info().builtWith}>
                  {(type) => (
                    <Check name="built" value={type}>
                      {experienceTypeLabels[type]}
                    </Check>
                  )}
                </For>
              </div>
              <Show when={errors().built}>
                {(message) => (
                  <p class="text-[13px] text-danger" role="alert">
                    {message()}
                  </p>
                )}
              </Show>
            </fieldset>
          </Show>

          <For each={data().options.tagGroups}>
            {(group) => (
              <fieldset>
                <legend class="text-sm font-semibold">{group.name}</legend>
                <Show when={group.description}>
                  <p class="mb-1 text-[13px] text-fg-3">{group.description}</p>
                </Show>
                <div class="flex flex-wrap gap-x-6">
                  <For each={group.tags}>
                    {(tag) => (
                      <Check
                        name="tags"
                        value={tag.slug}
                        // Portal's own tags for the code start ticked.
                        checked={
                          tag.portalId !== null &&
                          portalTags().includes(tag.portalId)
                        }
                      >
                        {tag.name}
                      </Check>
                    )}
                  </For>
                </div>
              </fieldset>
            )}
          </For>

          <fieldset class="grid gap-1">
            <legend class="mb-1.5 text-sm font-semibold">Building on it</legend>
            <Check name="isTemplate" value="true">
              Offer it as a template: others may take it and publish their own
              version
            </Check>
            <Check name="copyAllowed" value="true">
              It can be copied in the Portal editor
            </Check>
          </fieldset>

          <Section title="Pictures and links">
            <div class="grid gap-6">
              <FormField
                label="Cover picture"
                name="coverImgUrl"
                optional
                hint="An https:// address. Leave it empty to use the thumbnail from Portal."
                errors={errors()}
              >
                <input
                  id="coverImgUrl"
                  name="coverImgUrl"
                  type="url"
                  class={field}
                />
              </FormField>
              <FormField
                label="More pictures"
                name="images"
                optional
                hint={`One https:// address per line, up to ${MAX_IMAGES}.`}
                errors={errors()}
              >
                <textarea id="images" name="images" rows={3} class={field} />
              </FormField>
              <FormField label="Video" name="vidUrl" optional errors={errors()}>
                <input id="vidUrl" name="vidUrl" type="url" class={field} />
              </FormField>
              <FormField
                label="Source repository"
                name="repoUrl"
                optional
                errors={errors()}
              >
                <input id="repoUrl" name="repoUrl" type="url" class={field} />
              </FormField>
              <FormField
                label="Larger files"
                name="filesUrl"
                optional
                hint="A link to files hosted elsewhere: GitHub, Dropbox or Google Drive."
                errors={errors()}
              >
                <input id="filesUrl" name="filesUrl" type="url" class={field} />
              </FormField>
            </div>
          </Section>

          <Section title="Credits">
            <div class="grid gap-6">
              <Show when={data().options.sdkVersions.length > 0}>
                <FormField
                  label="Works with SDK"
                  name="sdk"
                  optional
                  hint="The release you last saw it working on."
                  errors={errors()}
                >
                  <select id="sdk" name="sdk" class={field}>
                    <option value="">Not said</option>
                    <For each={data().options.sdkVersions}>
                      {(sdk) => (
                        <option value={sdk.version}>
                          {sdk.version}
                          {sdk.season ? `, ${sdk.season}` : ''}
                        </option>
                      )}
                    </For>
                  </select>
                </FormField>
              </Show>
              <FormField
                label="Made with"
                name="credits"
                optional
                hint={`Names to credit, one per line, up to ${MAX_CREDITS}. For people with an account here, add them from the experience's page once it is approved.`}
                errors={errors()}
              >
                <textarea id="credits" name="credits" rows={3} class={field} />
              </FormField>
            </div>
          </Section>

          <div class="flex flex-wrap items-center gap-4 border-t border-line pt-6">
            <button type="submit" class={buttonAccent} disabled={sending()}>
              {sending() ? 'Submitting' : 'Submit for review'}
            </button>
            <p class="text-sm text-fg-3">
              Nothing is public until a moderator approves it.
            </p>
          </div>
        </form>
      </div>
    </PageLayout>
  )
}
