import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { Home } from '../functions/home'
import { defaultGame, gameList } from '../shared/games'
import { EventCard } from './event-card'
import { ExperienceCard } from './experience-card'
import { Icon } from './icon'
import { LibraryLink } from './library-link'
import { PlaytestCard } from './playtest-card'
import { ScriptRow } from './script-row'
import { SearchForm } from './search-form'
import { Section } from './section'
import { buttonSteel, display, panel } from './ui'
import { UpdateCard } from './update-card'

const more = 'inline-flex items-center gap-1.5 hover:text-fg'

function Stat(props: { value: number; label: string }) {
  return (
    <span>
      <b class="mr-1.5 font-display text-[21px] font-bold text-fg">
        {props.value}
      </b>
      {props.label}
    </span>
  )
}

/** The home page: a little of everything that is new or popular. */
export function HomePage(props: { data: Home }) {
  const data = () => props.data
  // The games after the first get a band at the foot of the page.
  const otherGames = () => gameList.filter((game) => game.id !== defaultGame.id)
  const countOf = (id: string) =>
    data().games.find((game) => game.id === id)?.count ?? 0

  return (
    <main id="content">
      <Show when={data().banner}>
        {(banner) => (
          <div class="border-b border-line bg-surface-2">
            <p class="wrap flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
              <Show when={banner().label}>
                {(label) => (
                  <span class="bg-accent px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.1em] text-accent-ink uppercase">
                    {label()}
                  </span>
                )}
              </Show>
              <span class="text-fg">{banner().message}</span>
              <Show when={banner().linkUrl}>
                {(url) => (
                  <a
                    href={url()}
                    class="font-semibold text-steel-hi underline hover:text-fg"
                  >
                    {banner().linkLabel ?? 'More'}
                  </a>
                )}
              </Show>
            </p>
          </div>
        )}
      </Show>

      <section class="relative overflow-hidden border-b border-line">
        <div
          class="dot-grid absolute inset-0 [mask-image:linear-gradient(105deg,rgb(0_0_0/0.9),rgb(0_0_0/0.25)_45%,transparent_72%)]"
          aria-hidden="true"
        />
        <div class="wrap relative pt-9 sm:pt-10">
          <h1 class="font-display text-[clamp(42px,4.6vw,64px)] leading-[0.92] font-extrabold tracking-[0.005em] text-steel-hi uppercase">
            The Portal creator hub
          </h1>
          <p class="mt-3 max-w-[34em] text-base text-fg-2">
            Experiences, scripts, maps and tools made by the community. Find
            something to play tonight, or share what you have built.
          </p>
          <SearchForm
            class="mt-5 block"
            action={defaultGame.libraryPath}
            placeholder="Search experiences by name, creator or code"
            label="Search experiences"
          />
          <p class="mt-7 flex flex-wrap gap-x-9 gap-y-1.5 border-t border-steel/15 py-3 text-[13.5px] text-fg-2">
            <Stat value={data().stats.experiences} label="experiences" />
            <Stat value={data().stats.scripts} label="scripts" />
            <Stat value={data().stats.creators} label="creators" />
          </p>
        </div>
      </section>

      <div class="wrap pb-20">
        <Show when={data().trending.length > 0}>
          <Section
            title="Trending experiences"
            note="What people liked this week."
            action={
              <LibraryLink game={defaultGame.id} class={more}>
                Browse the library
                <Icon name="arrow-right" class="size-3.5" />
              </LibraryLink>
            }
          >
            <div class="grid gap-4 min-[680px]:grid-cols-2 min-[680px]:gap-5 min-[1100px]:grid-cols-4">
              <For each={data().trending}>
                {(card) => <ExperienceCard experience={card} />}
              </For>
            </div>
          </Section>
        </Show>

        <Show when={data().updates.length > 0}>
          <Section
            title="Recent updates"
            note="News from creators about what they are building."
            action={
              <Link to="/updates" class={more}>
                All updates
                <Icon name="arrow-right" class="size-3.5" />
              </Link>
            }
          >
            <div class="grid gap-4 lg:grid-cols-3">
              <For each={data().updates}>
                {(update) => <UpdateCard update={update} now={data().now} />}
              </For>
            </div>
          </Section>
        </Show>

        <Show when={data().playtests.length > 0}>
          <Section
            title="Open playtests"
            note="Try something before it ships and tell its creator what you found."
            action={
              <Link to="/playtests" class={more}>
                All playtests
                <Icon name="arrow-right" class="size-3.5" />
              </Link>
            }
          >
            <div class="grid gap-4 lg:grid-cols-3">
              <For each={data().playtests}>
                {(playtest) => <PlaytestCard playtest={playtest} />}
              </For>
            </div>
          </Section>
        </Show>

        <Show when={data().scripts.length > 0}>
          <Section
            title="Trending scripts"
            note="Rules, logic and interface snippets to build on."
            action={
              <Link to="/scripts" class={more}>
                All scripts
                <Icon name="arrow-right" class="size-3.5" />
              </Link>
            }
          >
            <ul class={`${panel} divide-y divide-line`}>
              <For each={data().scripts}>
                {(script) => <ScriptRow script={script} />}
              </For>
            </ul>
          </Section>
        </Show>

        <Show when={data().events.length > 0}>
          <Section
            title="Upcoming events"
            note="Community nights, tournaments and workshops."
            action={
              <Link to="/events" class={more}>
                All events
                <Icon name="arrow-right" class="size-3.5" />
              </Link>
            }
          >
            <ul class="grid gap-4 lg:grid-cols-3">
              <For each={data().events}>
                {(event) => <EventCard event={event} />}
              </For>
            </ul>
          </Section>
        </Show>

        <For each={otherGames()}>
          {(game) => (
            <section
              data-game={game.id}
              class="mt-14 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border border-line border-l-2 border-l-accent bg-surface-1 px-6 py-6"
            >
              <div>
                <h2
                  class={`${display} text-3xl leading-none tracking-[0.02em] text-steel-hi`}
                >
                  The {game.name.replace('Battlefield ', '')} library lives on
                </h2>
                <p class="mt-2.5 max-w-[46em] text-[15.5px] text-fg-2">
                  {countOf(game.id)} experiences that still load, checked every
                  night against the game.
                </p>
              </div>
              <LibraryLink game={game.id} class={buttonSteel}>
                Open the {game.name.replace('Battlefield ', '')} library
                <Icon name="arrow-right" />
              </LibraryLink>
            </section>
          )}
        </For>
      </div>
    </main>
  )
}
