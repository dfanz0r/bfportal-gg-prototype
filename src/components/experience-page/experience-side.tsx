import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { Experience } from '../../functions/experience'
import { editorUrl, gameInfo, publicPageUrl } from '../../shared/games'
import { describeTeams } from '../../shared/teams'
import { Avatar } from '../ui/avatar'
import { BuiltWithTags } from '../ui/built-with-tags'
import { CopyCode } from '../ui/copy-code'
import { DateText } from '../ui/date-text'
import { Fact } from '../ui/fact'
import { Facts } from '../ui/facts'
import { Icon } from '../ui/icon'
import { LibraryLink } from '../ui/library-link'
import { PersonLink } from '../ui/person-link'
import { Regions } from '../ui/regions'
import { RepoLink } from '../ui/repo-link'
import { buttonGhost, label, panel, tag } from '../ui/ui'

type Credit = Experience['creators'][number]

function Person(props: { person: Credit; note?: string }) {
  return (
    <li class="flex items-center gap-2.5 text-sm font-medium">
      <Avatar
        name={props.person.name}
        image={props.person.image}
        class="size-7 text-[10px]"
      />
      <PersonLink person={props.person} class="min-w-0 truncate" />
      <Show when={props.note}>
        <span class="ml-auto text-xs font-normal text-fg-3">{props.note}</span>
      </Show>
    </li>
  )
}

/** What the code panel says about whether the code still works. */
function CodeState(props: { data: Experience }) {
  const data = () => props.data
  return (
    <Show
      when={!data().unavailable}
      fallback={
        <p class="flex gap-2 text-[13px] text-danger">
          <Icon name="alert" class="mt-0.5 size-3.5" />
          <span>
            <Show
              when={data().portalState !== 'published'}
              fallback="Reported as no longer loading."
            >
              No longer on Portal
              <Show when={data().portalStateSince}>
                {(since) => (
                  <>
                    {' '}
                    since <DateText value={since()} />
                  </>
                )}
              </Show>
              .
            </Show>
          </span>
        </p>
      }
    >
      <Show when={data().portalState === 'published' && data().portalCheckedAt}>
        {(checked) => (
          <p class="flex gap-2 text-[13px] text-fg-3">
            <Icon name="check" class="mt-0.5 size-3.5" />
            <span>
              On Portal. Checked <DateText value={checked()} now={data().now} />
              .
            </span>
          </p>
        )}
      </Show>
    </Show>
  )
}

/**
 * The side column of an experience page: the code, then what there is to know
 * at a glance. On a narrow window it comes before the description.
 */
export function ExperienceSide(props: { data: Experience }) {
  const data = () => props.data
  const info = () => gameInfo(data().game)
  const style = () => data().tags.filter((item) => item.group === 'Style')
  const otherTags = () => data().tags.filter((item) => item.group !== 'Style')
  // "16 v 16", "8 v 12 bots", or "17 teams of 2".
  const teams = () => describeTeams(data().teams)
  const publicPage = () => {
    const id = data().playgroundId
    return id ? publicPageUrl(data().game, id) : null
  }
  const editor = () => {
    const id = data().playgroundId
    return id && data().copyAllowed ? editorUrl(data().game, id) : null
  }

  return (
    <aside class="grid gap-4 max-[1099px]:order-first min-[1100px]:sticky min-[1100px]:top-20">
      <div class={`${panel} grid gap-3 p-5`}>
        <span class={label}>Experience code</span>
        <Show
          when={data().code}
          fallback={
            <p class="text-sm text-fg-2">
              {data().isTemplate
                ? 'This template has no code. Take its files instead.'
                : 'No code is recorded for this one.'}
            </p>
          }
        >
          {(code) => (
            <>
              <p class="font-mono text-[40px] leading-none font-semibold tracking-[0.14em] text-fg uppercase">
                {code()}
              </p>
              <CopyCode code={code()} label="Copy code" />
            </>
          )}
        </Show>
        <Show when={publicPage()}>
          {(url) => (
            <a href={url()} class={buttonGhost} rel="noopener">
              View on Battlefield
            </a>
          )}
        </Show>
        <Show when={editor()}>
          {(url) => (
            <a href={url()} class={buttonGhost} rel="noopener">
              Open in the Portal editor
            </a>
          )}
        </Show>
        <Show when={data().isTemplate && data().files.length > 0}>
          <a href="#files" class={buttonGhost}>
            <Icon name="layers" />
            Use as a template
          </a>
        </Show>
        <CodeState data={data()} />
      </div>

      <Show when={data().playtest}>
        {(playtest) => (
          <div class={`${panel} grid gap-2.5 p-5`}>
            <h2 class={label}>Open playtest</h2>
            <p class="text-sm font-semibold">
              <Show when={playtest().closesAt} fallback="Testers wanted">
                {(closes) => (
                  <>
                    Testers wanted until <DateText value={closes()} />
                  </>
                )}
              </Show>
            </p>
            <p class="text-sm text-fg-2">{playtest().summary}</p>
            <Regions regions={playtest().regions} />
            <Link
              to="/playtests/$id"
              params={{ id: String(playtest().id) }}
              class={buttonGhost}
            >
              Read the brief
            </Link>
          </div>
        )}
      </Show>

      <Facts>
        <Fact name="Game">{info().name}</Fact>
        <Fact name="Mode">{data().category.name}</Fact>
        <Show when={style().length > 0}>
          <Fact name="Style">
            {style()
              .map((item) => item.name)
              .join(', ')}
          </Fact>
        </Show>
        <Fact name="Lobby size">Up to {data().maxPlayers} players</Fact>
        <Show when={teams()}>
          {(format) => <Fact name="Teams">{format()}</Fact>}
        </Show>
        <Fact name="Bots">{data().maxBots || 'None'}</Fact>
        <Show when={data().rotation.length > 0}>
          <Fact name="Rotation">
            {data().rotation.length}{' '}
            {data().rotation.length === 1 ? 'map' : 'maps'}
          </Fact>
        </Show>
        <Show when={data().xpMode}>
          {(mode) => (
            <Fact name="XP">
              {mode() === 'portal-default' ? 'Full' : 'Limited'}
            </Fact>
          )}
        </Show>
        <Show when={info().hasFreeVersion && data().requiresFullGame !== null}>
          <Fact name="Needs">
            {data().requiresFullGame ? 'The full game' : 'Free to play'}
          </Fact>
        </Show>
        <Show when={data().sdk}>
          {(sdk) => (
            <Fact name="SDK">
              <span>
                {sdk().version}
                <span class="block text-xs font-normal text-fg-3">
                  {sdk().season}
                  <Show when={sdk().releasesBehind > 0}>
                    , {sdk().releasesBehind}{' '}
                    {sdk().releasesBehind === 1 ? 'release' : 'releases'} ago
                  </Show>
                </span>
              </span>
            </Fact>
          )}
        </Show>
      </Facts>

      <Show when={data().repoUrl}>{(url) => <RepoLink url={url()} />}</Show>

      <Show
        when={
          data().types.length > 0 || data().isTemplate || otherTags().length > 0
        }
      >
        <div class={`${panel} grid gap-4 p-5`}>
          <Show when={data().types.length > 0 || data().isTemplate}>
            <div>
              <h2 class={`${label} mb-2.5`}>Built with</h2>
              <ul class="flex flex-wrap gap-1.5">
                <BuiltWithTags
                  game={data().game}
                  types={data().types}
                  isTemplate={data().isTemplate}
                />
              </ul>
            </div>
          </Show>
          <Show when={otherTags().length > 0}>
            <div>
              <h2 class={`${label} mb-2.5`}>Tags</h2>
              <ul class="flex flex-wrap gap-1.5">
                <For each={otherTags()}>
                  {(item) => (
                    <li>
                      <LibraryLink
                        game={data().game}
                        search={{ tag: [item.slug] }}
                        class={`${tag} border-line text-fg-2 hover:border-steel hover:text-fg`}
                      >
                        {item.name}
                      </LibraryLink>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={data().owner || data().creators.length > 0}>
        <div class={`${panel} p-5`}>
          <h2 class={`${label} mb-3`}>Made by</h2>
          <ul class="grid gap-2.5">
            <Show when={data().owner}>
              {(owner) => <Person person={owner()} note="Owner" />}
            </Show>
            <For each={data().creators}>
              {(creator) => <Person person={creator} />}
            </For>
          </ul>
        </div>
      </Show>
    </aside>
  )
}
