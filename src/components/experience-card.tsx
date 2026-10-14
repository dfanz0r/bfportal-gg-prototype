import { For, Show } from 'solid-js'

import type { Library } from '../functions/library'
import { gameInfo } from '../shared/games'
import { Avatar } from './avatar'
import { BuiltWithTags } from './built-with-tags'
import { CopyCode } from './copy-code'
import { Icon } from './icon'
import { LibraryLink } from './library-link'
import { PersonLink } from './person-link'
import { tag } from './ui'

const chip =
  'inline-flex h-[22px] items-center gap-1.5 border-l-2 bg-base/80 px-2 font-mono text-[10.5px] font-medium tracking-[0.1em] uppercase backdrop-blur-sm'
const plain = `${tag} border-line text-fg-2 hover:border-steel hover:text-fg`
const stat =
  'inline-flex items-center gap-[5px] font-mono text-xs text-fg-2 tabular-nums'

/** One experience in a listing. Its links go to its own game's Library tab. */
export function ExperienceCard(props: {
  experience: Library['items'][number]
}) {
  const experience = () => props.experience
  const game = () => experience().game
  // The experience page is the next thing to be built. Until then this
  // address is the not-found page.
  const href = () => `/experiences/${experience().slug}`

  // A card that already says what it is built with has room for one topic
  // tag; more would wrap to a second row and make the cards uneven.
  const topicTags = () =>
    experience().tags.slice(
      0,
      experience().types.length > 0 || experience().isTemplate ? 1 : 2,
    )

  return (
    <article class="card-hover flex flex-col border border-line bg-surface-1">
      <div class="relative aspect-video overflow-hidden bg-surface-3">
        <Show when={experience().coverImgUrl}>
          {(cover) => (
            <img
              src={cover()}
              alt=""
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              class="size-full object-cover"
            />
          )}
        </Show>
        <span class={`${chip} absolute top-2.5 left-2.5 border-steel text-fg`}>
          {experience().category}
        </span>
        <span class="absolute top-2.5 right-2.5 inline-flex h-[22px] items-center gap-1.5 bg-base/80 px-2 font-mono text-[11.5px] text-fg tabular-nums backdrop-blur-sm">
          <Icon name="heart" class="size-3" />
          {experience().likes}
          <span class="sr-only"> likes</span>
        </span>
        {/* One state at most, the one that matters most to someone about to
            type the code in. */}
        <Show
          when={experience().unavailable}
          fallback={
            <Show
              when={experience().bugged}
              fallback={
                <Show when={experience().featured}>
                  <span
                    class={`${chip} absolute bottom-2.5 left-2.5 border-accent text-fg`}
                  >
                    <Icon name="star" class="size-3" />
                    Featured
                  </span>
                </Show>
              }
            >
              <span
                class={`${chip} absolute bottom-2.5 left-2.5 border-warn text-warn`}
              >
                <Icon name="alert" class="size-3" />
                Reported bugged
              </span>
            </Show>
          }
        >
          <span
            class={`${chip} absolute bottom-2.5 left-2.5 border-danger text-danger`}
          >
            <Icon name="alert" class="size-3" />
            No longer loads
          </span>
        </Show>
      </div>

      <div class="flex flex-1 flex-col gap-2 px-4 pt-4 pb-3.5">
        <h3 class="font-display text-2xl leading-[1.02] font-bold tracking-[0.015em] uppercase">
          {/* The link also covers the picture above, so that opens the page
              too without a second link for a screen reader to read out. */}
          <a
            href={href()}
            class="before:absolute before:inset-x-0 before:top-0 before:aspect-video before:content-[''] hover:text-steel-hi"
          >
            {experience().title}
          </a>
        </h3>
        <Show when={experience().excerpt}>
          <p class="line-clamp-2 text-sm leading-[1.45] text-fg-2">
            {experience().excerpt}
          </p>
        </Show>
        <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1.5">
          {/* "Up to", because a bare number beside this icon reads as how
              many are playing now. It is the size of the lobby. */}
          <span class={stat} title="The most players a match holds">
            <Icon name="users" class="size-3.5" />
            Up to {experience().maxPlayers}
            <span class="sr-only"> players</span>
          </span>
          <Show when={experience().maxBots > 0}>
            <span class={stat} title="bots">
              <Icon name="bot" class="size-3.5" />
              {experience().maxBots}
              <span class="sr-only"> bots</span>
            </span>
          </Show>
          <ul class="flex flex-wrap gap-1.5">
            <BuiltWithTags
              game={game()}
              types={experience().types}
              isTemplate={experience().isTemplate}
            />
            <Show
              when={
                gameInfo(game()).hasFreeVersion &&
                experience().requiresFullGame === false
              }
            >
              <li>
                <LibraryLink
                  game={game()}
                  search={{ free: true }}
                  class={plain}
                >
                  Free to play
                </LibraryLink>
              </li>
            </Show>
            <For each={topicTags()}>
              {(item) => (
                <li>
                  <LibraryLink
                    game={game()}
                    search={{ tag: [item.slug] }}
                    class={plain}
                  >
                    {item.name}
                  </LibraryLink>
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>

      <footer class="flex items-center justify-between gap-2.5 border-t border-line py-2.5 pr-3 pl-4">
        <Show when={experience().owner} fallback={<span />}>
          {(owner) => (
            <span class="inline-flex min-w-0 items-center gap-[7px] text-[13px] text-fg-2">
              <Avatar
                name={owner().name}
                image={owner().image}
                class="size-5 text-[9px]"
              />
              <PersonLink person={owner()} class="truncate" />
            </span>
          )}
        </Show>
        <Show when={experience().code}>
          {(code) => <CopyCode code={code()} />}
        </Show>
      </footer>
    </article>
  )
}
