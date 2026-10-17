import { useNavigate } from '@tanstack/solid-router'
import { createEffect, createMemo, createSignal, For, on, Show } from 'solid-js'

import type { Library } from '../functions/library'
import type { SubmitPageData } from '../functions/submit'
import { startFromCode, submitForReview } from '../functions/submit'
import { experienceTypeLabels } from '../shared/content'
import { MAX_CREDITS, MAX_MEDIA, REPO_HOSTS } from '../shared/experience-form'
import { formFields } from '../shared/form-input'
import { defaultGame, gameInfo } from '../shared/games'
import { submitLead } from '../shared/submit'
import { type TeamSetup, teamTotals } from '../shared/teams'
import { Check } from './check'
import { Choice } from './choice'
import { ChoiceGroup } from './choice-group'
import { CreditsInput } from './credits-input'
import { ExperienceCard } from './experience-card'
import { FormField } from './form-field'
import { FormSection } from './form-section'
import { Icon, type IconName } from './icon'
import { ImagePreview } from './image-preview'
import { MediaListInput } from './media-list-input'
import { PageLayout } from './page-layout'
import { SubmitStart } from './submit-start'
import { TeamSetupInput } from './team-setup-input'
import { buttonAccent, buttonGhost, field, label, panel } from './ui'

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

/** A field for a link, with an icon for what it leads to. */
function LinkInput(props: {
  name: string
  icon: IconName
  value: string | number
  placeholder?: string
}) {
  return (
    <div class="relative">
      <Icon
        name={props.icon}
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3"
      />
      <input
        id={props.name}
        name={props.name}
        type="url"
        value={props.value}
        placeholder={props.placeholder}
        class={`${field} pl-9`}
      />
    </div>
  )
}

const same = (one: unknown, other: unknown) =>
  JSON.stringify(one) === JSON.stringify(other)

/** The page for sharing an experience. */
export function SubmitPage(props: { data: SubmitPageData }) {
  const data = () => props.data
  const info = () => gameInfo(data().game)
  const navigate = useNavigate()
  // What the fields start from: a form that was posted with no script and
  // refused, which comes back as a draft with what was wrong, and what Portal
  // says about the code. Both are remembered by what they say. A field is
  // written to whenever what it starts from is read again, so going to the
  // other game's form, which loads the page's data again, would otherwise
  // wipe everything typed so far.
  const draft = createMemo(() => data().draft, undefined, { equals: same })
  const found = createMemo(() => data().found, undefined, { equals: same })
  const [errors, setErrors] = createSignal<Record<string, string>>(
    // Read once on purpose, so the server's HTML carries them too.
    props.data.draft?.errors ?? {},
  )
  // What was wrong was wrong with the form as it was loaded.
  createEffect(on(data, () => setErrors(draft()?.errors ?? {})))
  const [sending, setSending] = createSignal(false)
  const portalTags = () => found()?.tags ?? []

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
  let filledIn: HTMLFormElement | undefined
  // Going to the other game's form keeps this page and changes what it
  // offers: other categories, other tags. What was read from the form before
  // is then about fields that are gone, so it is read again.
  createEffect(
    on(
      data,
      () => {
        if (typed() && filledIn) {
          setTyped(formFields(new FormData(filledIn)))
        }
      },
      { defer: true },
    ),
  )
  const now = (name: string, otherwise: string | number = '') => {
    const fields = typed()
    return fields ? String(fields[name] ?? '') : String(start(name, otherwise))
  }
  const nowChosen = (name: string, initially: string[]) => {
    const fields = typed()
    return fields ? [fields[name] ?? []].flat().map(String) : initially
  }
  /** The teams as the form holds them now, or null before it is typed in. */
  const typedTeams = (): TeamSetup | null => {
    const fields = typed() ?? draft()?.fields
    const players = [fields?.teamPlayers ?? []].flat()
    if (players.length === 0) return null
    const bots = [fields?.teamBots ?? []].flat()
    const held = (value: unknown) =>
      Math.min(Math.max(Math.round(Number(value)) || 0, 0), info().maxPlayers)
    return players.map((value, index) => ({
      players: held(value),
      bots: held(bots[index]),
    }))
  }
  /**
   * The teams the form starts with each time the page's data loads: as they
   * were set, which going to the other game's form keeps, or else as Portal
   * sets them out for the first map, or else two even teams. Worked out only
   * then, not as they are typed in: an emptied box would otherwise be filled
   * in again while it is still being typed in.
   */
  const startTeams = createMemo(
    on(data, (): TeamSetup => {
      const kept = typedTeams()
      if (kept) return kept
      const fromPortal = found()?.teams.filter((size) => size > 0) ?? []
      if (fromPortal.length > 0) {
        return fromPortal.map((players) => ({
          players: Math.min(players, info().maxPlayers),
          bots: 0,
        }))
      }
      const even = info().maxPlayers / 4
      return [
        { players: even, bots: 0 },
        { players: even, bots: 0 },
      ]
    }),
  )
  /**
   * The category chosen: the one picked, if this game's form offers it, or
   * else the one the form starts on. One game has categories another has not,
   * and the router keeps the rows both share when the page goes from one
   * form to the other, so a pick that is no longer offered would otherwise
   * leave none chosen.
   */
  const category = createMemo(() => {
    const offered = data().options.categories
    const picked = typed()?.category
    return (
      offered.find((item) => item.slug === picked) ??
      offered.find((item, index) => ticked('category', item.slug, index === 0))
    )
  })
  /** The card this would be in a listing, as far as the form says so far. */
  const preview = (): Card => {
    const allTags = data().options.tagGroups.flatMap((group) => group.tags)
    const tags = nowChosen(
      'tags',
      allTags
        .filter((tag) => ticked('tags', tag.slug, fromPortal(tag)))
        .map((tag) => tag.slug),
    )
    const built = nowChosen(
      'built',
      info().builtWith.filter((type) => ticked('built', type)),
    )
    const listedIn = category()
    return {
      id: 0,
      game: data().game,
      slug: '',
      title: now('title', found()?.title) || 'Your title',
      excerpt: now('description', found()?.description).slice(0, 140),
      coverImgUrl:
        now('coverImgUrl') || (found()?.thumbnailUrl ?? null) || null,
      category: listedIn?.name ?? '',
      maxPlayers: teamTotals(typedTeams() ?? startTeams()).players,
      maxBots: teamTotals(typedTeams() ?? startTeams()).bots,
      types: info().builtWith.filter((type) => built.includes(type)),
      // Chosen on the form where the game has that choice, or said by the
      // category: the same rule the server applies.
      isTemplate:
        (info().hasExport &&
          nowChosen(
            'isTemplate',
            ticked('isTemplate', 'true') ? ['true'] : [],
          ).includes('true')) ||
        (listedIn?.marksTemplate ?? false),
      code: now('code', data().code || found()?.code || '') || null,
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

  let fetchButton: HTMLButtonElement | undefined
  /** Goes to the page for the code or link in the form, keeping this one. */
  const fetchDetails = (form: HTMLFormElement) => {
    const fields = new FormData(form)
    const typedIn = (name: string) =>
      String(fields.get(name) ?? '').trim() || undefined
    void navigate({
      to: '/submit',
      search: {
        game: data().game === defaultGame.id ? undefined : data().game,
        code: typedIn('code'),
        link: typedIn('link'),
      },
      resetScroll: false,
    })
  }
  // Enter in the code or the link is asking for its details.
  const fetchOnEnter = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    fetchButton?.click()
  }

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const form = event.currentTarget as HTMLFormElement
    if (event.submitter === fetchButton) {
      fetchDetails(form)
      return
    }
    if (sending()) return
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
    <PageLayout title="Submit" lead={submitLead}>
      <div
        class="grid items-start gap-8 min-[1100px]:grid-cols-[minmax(0,1fr)_348px] min-[1100px]:gap-10"
        data-game={data().game}
      >
        <div class="min-w-0">
          {/* The game comes first, and choosing one goes to its form. */}
          <SubmitStart game={data().game} kind="experience" />

          <form
            ref={filledIn}
            method="post"
            action={submitForReview.url}
            onSubmit={submit}
            onInput={(event) =>
              setTyped(formFields(new FormData(event.currentTarget)))
            }
          >
            {/* Enter in a field presses a form's first button. This is that
                button, so Enter submits, as the button at the bottom does,
                and does not fetch the details again. */}
            <button type="submit" hidden />
            <input type="hidden" name="game" value={data().game} />

            <FormSection
              title="Start from your code"
              note="We fill in most of the form from it."
            >
              <FormField
                label="Experience code"
                name="code"
                // Said in the label, as the mockup has it, and not in a line
                // under the field: a line only one game's form has moves
                // everything below it.
                optional={info().hasExport && 'Optional for a template'}
                errors={errors()}
              >
                <div class="flex gap-2">
                  <input
                    id="code"
                    name="code"
                    value={data().code || found()?.code || ''}
                    autocomplete="off"
                    spellcheck={false}
                    onKeyDown={fetchOnEnter}
                    class={`${field} font-mono tracking-[0.12em] uppercase`}
                  />
                  {/* The code and link are what is submitted. With no
                      script this posts the form to a function that goes to
                      the page for the code; the script goes there itself. */}
                  <button
                    ref={fetchButton}
                    type="submit"
                    formaction={startFromCode.url}
                    formnovalidate
                    class={`${buttonGhost} h-[42px]`}
                  >
                    <Icon name="search" />
                    Fetch details
                  </button>
                </div>
              </FormField>
              <FormField
                label="Or a link to it on Portal"
                name="link"
                optional
                errors={errors()}
              >
                <input
                  id="link"
                  name="link"
                  type="url"
                  value={data().link}
                  placeholder="https://portal.battlefield.com/..."
                  onKeyDown={fetchOnEnter}
                  class={field}
                />
              </FormField>
              <LookupNote data={data()} />
            </FormSection>

            {/* What is wrong with no field of its own to sit under. */}
            <Show when={errors().form ?? errors().game}>
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
                  {(item) => (
                    <Choice
                      radio
                      name="category"
                      value={item.slug}
                      checked={category()?.slug === item.slug}
                    >
                      {item.name}
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
                {/* Without an export a template is a category, chosen above. */}
                <Show when={info().hasExport}>
                  <Check
                    name="isTemplate"
                    value="true"
                    checked={ticked('isTemplate', 'true')}
                  >
                    Offer it as a template: others may take it and publish their
                    own version
                  </Check>
                </Show>
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
                  value={start('title', found()?.title)}
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
                  {start('description', found()?.description)}
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
                label="Co-creators"
                name="credits"
                optional
                hint={`Up to ${MAX_CREDITS}. Someone with an account here is asked, and shown once they accept. Anyone else is added as a name.`}
                errors={{
                  credits: errors().credits ?? errors().creditAccounts ?? '',
                }}
              >
                <CreditsInput
                  id="credits"
                  names={[draft()?.fields.credits ?? []]
                    .flat()
                    .flatMap((name) => String(name).split('\n'))
                    .map((name) => name.trim())
                    .filter(Boolean)}
                  accounts={data().credited}
                  max={MAX_CREDITS}
                />
              </FormField>
            </FormSection>

            <FormSection title="Teams">
              <TeamSetupInput
                teams={startTeams()}
                max={info().maxPlayers}
                gameName={info().name}
                error={
                  errors().teams ?? errors().teamPlayers ?? errors().teamBots
                }
              />
            </FormSection>

            <FormSection title="Media and links">
              {/* The picture beside its field on a wide window, and under
                  it on a narrow one, where the label comes first. */}
              <div class="grid items-start gap-x-5 gap-y-3 sm:grid-cols-[208px_minmax(0,1fr)]">
                <div class="sm:col-start-2 sm:row-start-1">
                  <FormField
                    label="Cover image"
                    name="coverImgUrl"
                    optional
                    hint="A direct https:// link to an image, 16:9. Empty uses the thumbnail from Portal."
                    errors={errors()}
                  >
                    <LinkInput
                      name="coverImgUrl"
                      icon="image"
                      value={start('coverImgUrl')}
                      placeholder="https://..."
                    />
                  </FormField>
                </div>
                <ImagePreview
                  src={now('coverImgUrl') || found()?.thumbnailUrl}
                  note={
                    now('coverImgUrl') || !found()?.thumbnailUrl
                      ? undefined
                      : 'From Portal'
                  }
                  class="max-sm:max-w-[240px] sm:col-start-1 sm:row-start-1"
                />
              </div>
              <FormField
                label="Media"
                name="media"
                optional
                hint="Links to images or YouTube videos. Shown in a gallery after the cover, in this order."
                errors={errors()}
              >
                <MediaListInput
                  name="media"
                  links={[draft()?.fields.media ?? []]
                    .flat()
                    .map(String)
                    .filter((url) => url.trim())}
                  max={MAX_MEDIA}
                />
              </FormField>
              <div class="grid items-start gap-x-5 gap-y-[18px] sm:grid-cols-2">
                <FormField
                  label="Source repository"
                  name="repoUrl"
                  optional
                  hint={`On ${REPO_HOSTS.join(', ')}.`}
                  errors={errors()}
                >
                  <LinkInput
                    name="repoUrl"
                    icon="code"
                    value={start('repoUrl')}
                    placeholder="https://github.com/..."
                  />
                </FormField>
                <Show when={info().hasExport}>
                  <FormField
                    label="Larger files"
                    name="filesUrl"
                    optional
                    hint="On GitHub, Dropbox or Google Drive."
                    errors={errors()}
                  >
                    <LinkInput
                      name="filesUrl"
                      icon="download"
                      value={start('filesUrl')}
                      placeholder="https://..."
                    />
                  </FormField>
                </Show>
              </div>
            </FormSection>

            <div class="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line pt-6">
              <button
                type="submit"
                class={`${buttonAccent} h-11 px-6`}
                disabled={sending()}
              >
                {sending() ? 'Submitting' : 'Submit for review'}
                <Icon name="arrow-right" />
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
