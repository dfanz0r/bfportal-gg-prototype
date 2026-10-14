import { useNavigate } from '@tanstack/solid-router'
import { createEffect, createSignal, For, Show } from 'solid-js'

import type { Library } from '../functions/library'
import type { SubmitPageData } from '../functions/submit'
import { submitForReview } from '../functions/submit'
import { experienceTypeLabels } from '../shared/content'
import { MAX_CREDITS, MAX_IMAGES, VIDEO_HOSTS } from '../shared/experience-form'
import { formFields } from '../shared/form-input'
import { gameInfo, gameList } from '../shared/games'
import { Check } from './check'
import { Choice } from './choice'
import { ChoiceGroup } from './choice-group'
import { ExperienceCard } from './experience-card'
import { FormField } from './form-field'
import { FormSection } from './form-section'
import { Icon } from './icon'
import { PageLayout } from './page-layout'
import { buttonAccent, buttonGhost, field, label, panel } from './ui'

const LEAD =
  'Share something you built in Portal. A moderator looks at every new submission before it goes live, usually within a day.'

type Card = Library['items'][number]

const RULES = [
  'The code or link must open your experience in Portal.',
  'The cover image must be yours to use and safe for work.',
  'XP farms are listed, but marked as such.',
  'Submit each experience once. If you change it later, edit its page instead of submitting it again.',
  'Only offer files as a template if you made them, or have permission to share them.',
]

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
            <p class={`${label} inline-flex items-center gap-1.5`}>
              <Icon name="check" class="size-3.5 text-fg" />
              Found on Portal
            </p>
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

  // What is in the form right now, once anything in it has been changed. Until
  // then the card beside the form is drawn from what the form started with,
  // which is also what the server draws.
  const [typed, setTyped] = createSignal<ReturnType<typeof formFields>>()
  const now = (name: string, otherwise: string | number = '') => {
    const fields = typed()
    return fields ? String(fields[name] ?? '') : String(start(name, otherwise))
  }
  const nowChosen = (name: string, initially: string[]) => {
    const fields = typed()
    return fields ? [fields[name] ?? []].flat().map(String) : initially
  }
  /** The card this would be in a listing, as far as the form says so far. */
  const preview = (): Card => {
    const allTags = data().options.tagGroups.flatMap((group) => group.tags)
    const tags = nowChosen(
      'tags',
      allTags
        .filter((tag) => ticked('tags', tag.slug, fromPortal(tag)))
        .map((tag) => tag.slug),
    )
    const category = now(
      'category',
      data().options.categories.find((item, index) =>
        ticked('category', item.slug, index === 0),
      )?.slug,
    )
    const built = nowChosen(
      'built',
      info().builtWith.filter((type) => ticked('built', type)),
    )
    return {
      id: 0,
      game: data().game,
      slug: '',
      title: now('title', data().found?.title) || 'Your title',
      excerpt: now('description', data().found?.description).slice(0, 140),
      coverImgUrl:
        now('coverImgUrl') || (data().found?.thumbnailUrl ?? null) || null,
      category:
        data().options.categories.find((item) => item.slug === category)
          ?.name ?? '',
      maxPlayers: Number(now('maxPlayers', data().found?.players || 0)) || 0,
      maxBots: Number(now('maxBots', 0)) || 0,
      types: info().builtWith.filter((type) => built.includes(type)),
      isTemplate: nowChosen(
        'isTemplate',
        ticked('isTemplate', 'true') ? ['true'] : [],
      ).includes('true'),
      code: data().code,
      likes: 0,
      featured: false,
      bugged: false,
      unavailable: false,
      requiresFullGame: null,
      owner: null,
      tags: allTags
        .filter((tag) => tags.includes(tag.slug))
        .slice(0, 2)
        .map((tag) => ({ name: tag.name, slug: tag.slug })),
    }
  }

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
    <PageLayout title="Submit" lead={LEAD}>
      <div
        class="grid items-start gap-8 min-[1100px]:grid-cols-[minmax(0,1fr)_348px] min-[1100px]:gap-10"
        data-game={data().game}
      >
        <div class="min-w-0">
          {/* The game comes first, then the code. A GET form: both go in the
              address, and the page comes back for that game with what Portal
              says about the code. */}
          <form method="get" action="/submit">
            <FormSection title="Which game is it for?">
              <div class="grid gap-2.5 sm:grid-cols-2">
                <For each={gameList}>
                  {(game) => (
                    <label class="relative grid cursor-pointer gap-0.5 border border-line-strong px-3.5 pt-[11px] pb-3 hover:border-steel has-checked:border-accent has-checked:bg-accent/12 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
                      <input
                        type="radio"
                        name="game"
                        value={game.id}
                        checked={game.id === data().game}
                        class="sr-only"
                      />
                      <b class="text-[15px] font-semibold">{game.name}</b>
                      <small class="text-[13px] text-fg-3">
                        {game.submitNote}
                      </small>
                    </label>
                  )}
                </For>
              </div>
            </FormSection>

            <FormSection
              title="Start from your code"
              note="We fill in most of the form from it."
            >
              <FormField
                label="Experience code"
                name="lookup-code"
                hint="No code yet? A template can be shared as files alone: tick “Offer it as a template” below."
              >
                <div class="flex gap-2">
                  <input
                    id="lookup-code"
                    name="code"
                    value={data().code ?? ''}
                    autocomplete="off"
                    spellcheck={false}
                    class={`${field} font-mono tracking-[0.12em] uppercase`}
                  />
                  <button type="submit" class={`${buttonGhost} h-[42px]`}>
                    Fetch details
                  </button>
                </div>
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
                  placeholder="https://portal.battlefield.com/..."
                  class={field}
                />
              </FormField>
              <LookupNote data={data()} />
            </FormSection>
          </form>

          <form
            method="post"
            action={submitForReview.url}
            onSubmit={submit}
            onInput={(event) =>
              setTyped(formFields(new FormData(event.currentTarget)))
            }
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
                  class="mb-8 border-l-2 border-danger bg-danger/8 px-4 py-3 text-sm text-fg"
                  role="alert"
                >
                  {message()}
                </p>
              )}
            </Show>

            <FormSection title="How it is listed">
              <ChoiceGroup label="Category" error={errors().category}>
                <For each={data().options.categories}>
                  {(category, index) => (
                    <Choice
                      radio
                      name="category"
                      value={category.slug}
                      checked={ticked('category', category.slug, index() === 0)}
                    >
                      {category.name}
                    </Choice>
                  )}
                </For>
              </ChoiceGroup>
              <Show when={info().builtWith.length > 0}>
                <ChoiceGroup
                  label="Built with"
                  hint="A verified mode uses none of the first three."
                  error={errors().built}
                >
                  <For each={info().builtWith}>
                    {(type) => (
                      <Choice
                        name="built"
                        value={type}
                        checked={ticked('built', type)}
                      >
                        {experienceTypeLabels[type]}
                      </Choice>
                    )}
                  </For>
                </ChoiceGroup>
              </Show>
              <div class="grid gap-1">
                <Check
                  name="isTemplate"
                  value="true"
                  checked={ticked('isTemplate', 'true')}
                >
                  Offer it as a template: others may take it and publish their
                  own version
                </Check>
                <Check
                  name="copyAllowed"
                  value="true"
                  checked={ticked('copyAllowed', 'true')}
                >
                  It can be copied in the Portal editor
                </Check>
              </div>
            </FormSection>

            <FormSection title="What it is">
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

              {/* Portal's own tags for the code start chosen. A group that
                  takes one choice is a list to pick from, which a browser
                  holds to one without any script. */}
              <For each={data().options.tagGroups}>
                {(group) => (
                  <Show
                    when={group.pick === 'one'}
                    fallback={
                      <ChoiceGroup
                        label={group.name}
                        optional
                        hint={group.description ?? undefined}
                      >
                        <For each={group.tags}>
                          {(tag) => (
                            <Choice
                              name="tags"
                              value={tag.slug}
                              checked={ticked(
                                'tags',
                                tag.slug,
                                fromPortal(tag),
                              )}
                            >
                              {tag.name}
                            </Choice>
                          )}
                        </For>
                      </ChoiceGroup>
                    }
                  >
                    <FormField
                      label={group.name}
                      name={`tags-${group.name}`}
                      optional
                      hint={group.description ?? undefined}
                    >
                      <select
                        id={`tags-${group.name}`}
                        name="tags"
                        class={`${field} max-w-xs`}
                      >
                        <option value="">Not said</option>
                        <For each={group.tags}>
                          {(tag) => (
                            <option
                              value={tag.slug}
                              selected={ticked(
                                'tags',
                                tag.slug,
                                fromPortal(tag),
                              )}
                            >
                              {tag.name}
                            </option>
                          )}
                        </For>
                      </select>
                    </FormField>
                  </Show>
                )}
              </For>
              <Show when={errors().tags}>
                {(message) => (
                  <p class="text-[13px] text-danger" role="alert">
                    {message()}
                  </p>
                )}
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
            </FormSection>

            <FormSection title="Setup">
              <div class="grid items-start gap-x-5 gap-y-[18px] sm:grid-cols-2">
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
            </FormSection>

            <FormSection title="Media and links">
              <FormField
                label="Cover image"
                name="coverImgUrl"
                optional
                hint="A direct https:// link to an image. 16:9 works best. Leave it empty to use the thumbnail from Portal."
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
                label="More images"
                name="images"
                optional
                hint={`One https:// link per line, up to ${MAX_IMAGES}. Shown in a gallery on the page, in this order.`}
                errors={errors()}
              >
                <textarea id="images" name="images" rows={3} class={field}>
                  {start('images')}
                </textarea>
              </FormField>
              <div class="grid items-start gap-x-5 gap-y-[18px] sm:grid-cols-2">
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
                    placeholder="https://youtu.be/..."
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
                    placeholder="https://github.com/..."
                    class={field}
                  />
                </FormField>
              </div>
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
            </FormSection>

            <div class="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-6">
              <button
                type="submit"
                class={`${buttonAccent} h-11 px-6`}
                disabled={sending()}
              >
                {sending() ? 'Submitting' : 'Submit for review'}
              </button>
              <a href="/" class={`${buttonGhost} h-11 px-6`}>
                Cancel
              </a>
              <p class="max-w-[34em] text-[13.5px] text-fg-3">
                Nothing is public until a moderator approves it.
                {/* Not asked for: a game only runs its latest release. */}
                <Show when={data().options.currentSdk}>
                  {(sdk) => (
                    <>
                      {' '}
                      It will be listed for Portal SDK {sdk().version}, the
                      current release.
                    </>
                  )}
                </Show>
              </p>
            </div>
          </form>
        </div>

        <aside class="grid gap-4 min-[1100px]:sticky min-[1100px]:top-20">
          <div>
            <h2 class={`${label} mb-3`}>How it will look</h2>
            {/* A picture of the card, not the card: it has no page to open
                yet, so nothing in it can be pressed or tabbed to. */}
            <div inert aria-hidden="true">
              <ExperienceCard experience={preview()} />
            </div>
          </div>
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
