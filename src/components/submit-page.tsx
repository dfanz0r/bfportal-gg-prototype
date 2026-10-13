import { useNavigate } from '@tanstack/solid-router'
import { createEffect, createSignal, For, Show } from 'solid-js'

import type { SubmitPageData } from '../functions/submit'
import { submitForReview } from '../functions/submit'
import { experienceTypeLabels } from '../shared/content'
import { MAX_CREDITS, MAX_IMAGES, VIDEO_HOSTS } from '../shared/experience-form'
import { formFields } from '../shared/form-input'
import { gameInfo, gameList } from '../shared/games'
import { Check } from './check'
import { FieldError } from './field-error'
import { FormField } from './form-field'
import { PageLayout } from './page-layout'
import { Section } from './section'
import { body, buttonAccent, buttonSteel, field, label, panel } from './ui'

const LEAD =
  'Share something you built in Portal. A moderator looks at every submission before it appears.'

/** What to say when a lookup did not come back with an experience. */
const LOOKUP_NOTES: Partial<
  Record<NonNullable<SubmitPageData['lookup']>, string>
> = {
  missing: 'Portal has no experience with this code. Check it and try again.',
  unavailable:
    'Portal could not be asked about this code just now. You can still fill in the form and submit it.',
  limited:
    'That is a lot of lookups in a short time. Wait a minute, then fetch it again.',
}

/** What Portal said about the code, in a sentence. */
function LookupNote(props: { data: SubmitPageData }) {
  const data = () => props.data
  const note = () => {
    if (data().unreadable) {
      return `That does not look like a ${gameInfo(data().game).name} experience code or a link to one.`
    }
    const lookup = data().lookup
    return lookup ? LOOKUP_NOTES[lookup] : undefined
  }
  return (
    <Show
      when={data().found}
      fallback={
        <Show when={note()}>
          {(text) => (
            <p class="border-l-2 border-warn bg-warn/8 px-4 py-3 text-sm text-fg-2">
              {text()}
            </p>
          )}
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
export function SubmitPage(props: { data: SubmitPageData }) {
  const data = () => props.data
  const info = () => gameInfo(data().game)
  const navigate = useNavigate()
  // A form that was posted with no script and refused comes back as a draft:
  // what was sent, and what was wrong with it.
  const draft = () => data().draft
  const [errors, setErrors] = createSignal<Record<string, string>>(
    // Read once on purpose, so the server's HTML carries them too.
    props.data.draft?.errors ?? {},
  )
  createEffect(() => setErrors(draft()?.errors ?? {}))
  const [sending, setSending] = createSignal(false)
  const portalTags = () => data().found?.tags ?? []

  /** What a field starts with: what was sent last time, or else `otherwise`. */
  const start = (name: string, otherwise: string | number = '') => {
    const value = draft()?.fields[name]
    return typeof value === 'string' ? value : otherwise
  }
  /** Whether a box starts ticked. A draft knows every box that was. */
  const ticked = (name: string, value: string, otherwise = false) => {
    const kept = draft()
    return kept ? [kept.fields[name] ?? []].flat().includes(value) : otherwise
  }
  const fromPortal = (tag: { portalId: string | null }) =>
    tag.portalId !== null && portalTags().includes(tag.portalId)

  const fail = (form: HTMLFormElement, problems: Record<string, string>) => {
    setErrors(problems)
    setSending(false)
    form.querySelector('[role="alert"]')?.scrollIntoView({ block: 'center' })
  }

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (sending()) return
    const form = event.currentTarget as HTMLFormElement
    setSending(true)
    let result: Awaited<ReturnType<typeof submitForReview>>
    try {
      result = await submitForReview({ data: formFields(new FormData(form)) })
    } catch {
      // No answer came back, which does not say the request never arrived.
      fail(form, {
        form: 'Something went wrong before an answer came back, so this may or may not have been submitted. You can send it again: if both went through, a moderator will see they are the same.',
      })
      return
    }
    if (result.ok) {
      // It is in. Whatever happens now, it must not read as a failure, and
      // the button stays off so it is not sent twice.
      const page = `/experiences/${result.slug}`
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

          {/* What is wrong with no field of its own to sit under. */}
          <Show
            when={
              errors().form ?? errors().code ?? errors().link ?? errors().game
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
              value={start('title', data().found?.title)}
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
                    checked={ticked('category', category.slug, index() === 0)}
                  >
                    {category.name}
                  </Check>
                )}
              </For>
            </div>
            <FieldError message={errors().category} />
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
              {start('description', data().found?.description)}
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
                value={start('maxPlayers', data().found?.players || '')}
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
                value={start('maxBots', 0)}
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
                    <Check
                      name="built"
                      value={type}
                      checked={ticked('built', type)}
                    >
                      {experienceTypeLabels[type]}
                    </Check>
                  )}
                </For>
              </div>
              <FieldError message={errors().built} />
            </fieldset>
          </Show>

          <For each={data().options.tagGroups}>
            {(group) => (
              <fieldset>
                <legend class="text-sm font-semibold">{group.name}</legend>
                <Show when={group.description}>
                  <p class="mb-1 text-[13px] text-fg-3">{group.description}</p>
                </Show>
                {/* Portal's own tags for the code start chosen. A group that
                    takes one choice is a list to pick from, which a browser
                    holds to one without any script. */}
                <Show
                  when={group.pick === 'one'}
                  fallback={
                    <div class="flex flex-wrap gap-x-6">
                      <For each={group.tags}>
                        {(tag) => (
                          <Check
                            name="tags"
                            value={tag.slug}
                            checked={ticked('tags', tag.slug, fromPortal(tag))}
                          >
                            {tag.name}
                          </Check>
                        )}
                      </For>
                    </div>
                  }
                >
                  <select
                    name="tags"
                    aria-label={group.name}
                    class={`${field} mt-1.5 max-w-xs`}
                  >
                    <option value="">Not said</option>
                    <For each={group.tags}>
                      {(tag) => (
                        <option
                          value={tag.slug}
                          selected={ticked('tags', tag.slug, fromPortal(tag))}
                        >
                          {tag.name}
                        </option>
                      )}
                    </For>
                  </select>
                </Show>
              </fieldset>
            )}
          </For>
          <FieldError message={errors().tags} />

          <fieldset class="grid gap-1">
            <legend class="mb-1.5 text-sm font-semibold">Building on it</legend>
            <Check
              name="isTemplate"
              value="true"
              checked={ticked('isTemplate', 'true')}
            >
              Offer it as a template: others may take it and publish their own
              version
            </Check>
            <Check
              name="copyAllowed"
              value="true"
              checked={ticked('copyAllowed', 'true')}
            >
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
                  value={start('coverImgUrl')}
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
                <textarea id="images" name="images" rows={3} class={field}>
                  {start('images')}
                </textarea>
              </FormField>
              <FormField
                label="Video"
                name="vidUrl"
                optional
                hint={`A link to it on ${VIDEO_HOSTS.join(', ')}.`}
                errors={errors()}
              >
                <input
                  id="vidUrl"
                  name="vidUrl"
                  type="url"
                  value={start('vidUrl')}
                  class={field}
                />
              </FormField>
              <FormField
                label="Source repository"
                name="repoUrl"
                optional
                errors={errors()}
              >
                <input
                  id="repoUrl"
                  name="repoUrl"
                  type="url"
                  value={start('repoUrl')}
                  class={field}
                />
              </FormField>
              <FormField
                label="Larger files"
                name="filesUrl"
                optional
                hint="A link to files hosted elsewhere: GitHub, Dropbox or Google Drive."
                errors={errors()}
              >
                <input
                  id="filesUrl"
                  name="filesUrl"
                  type="url"
                  value={start('filesUrl')}
                  class={field}
                />
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
                        <option
                          value={sdk.version}
                          selected={start('sdk') === sdk.version}
                        >
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
                <textarea id="credits" name="credits" rows={3} class={field}>
                  {start('credits')}
                </textarea>
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
