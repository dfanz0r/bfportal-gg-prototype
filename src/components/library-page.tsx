import { For, Show } from 'solid-js'

import type { Library } from '../functions/library'
import { gameInfo } from '../shared/games'
import {
  type LibrarySearch,
  MAX_PAGES,
  PAGE_SIZE,
} from '../shared/library-search'
import { DateText } from './date-text'
import { ExperienceCard } from './experience-card'
import { LibraryFilters } from './library-filters'
import { LibraryLink } from './library-link'
import { SearchForm } from './search-form'
import { ShowMore } from './show-more'
import { buttonGhost } from './ui'

/** What the address needs to say: the search without what is the default. */
function addressOf(data: Library): LibrarySearch {
  const { sort, page, ...rest } = data.search
  return {
    ...rest,
    sort: sort === gameInfo(data.game).library.sort ? undefined : sort,
    page: page > 1 ? page : undefined,
  }
}

/** The head of a Library page: title, description and its one true address. */
export function libraryHead(data: Library | undefined) {
  if (!data) return {}
  const info = gameInfo(data.game)
  const title = `${info.library.title} · bfportal.gg`
  // A filtered or longer listing is the same page as far as search goes.
  const canonical = `${data.siteUrl}${info.libraryPath}`
  return {
    meta: [
      { title },
      { name: 'description', content: info.library.lead },
      { property: 'og:title', content: title },
      { property: 'og:description', content: info.library.lead },
      { property: 'og:url', content: canonical },
      { property: 'og:type', content: 'website' },
    ],
    links: [{ rel: 'canonical', href: canonical }],
  }
}

/** One game's tab of the Library. */
export function LibraryPage(props: { data: Library }) {
  const info = () => gameInfo(props.data.game)
  const address = () => addressOf(props.data)
  const shown = () => props.data.items.length
  const left = () => props.data.total - shown()

  return (
    <main id="content" data-game={props.data.game}>
      <section class="dot-grid border-b border-line bg-surface-1">
        <div class="wrap pt-5">
          <nav
            class="flex gap-[18px] border-b border-steel/15 sm:gap-7"
            aria-label="Game"
          >
            <For each={props.data.games}>
              {(game) => (
                <LibraryLink
                  game={game.id}
                  aria-current={
                    game.id === props.data.game ? 'page' : undefined
                  }
                  class="flex items-baseline gap-2 border-b-2 border-transparent pt-2.5 pb-3 text-[13px] font-semibold tracking-[0.06em] text-fg-3 uppercase hover:text-fg aria-[current=page]:border-accent aria-[current=page]:text-fg sm:text-sm"
                >
                  {game.name}
                  <span class="font-mono text-[11.5px] font-normal tracking-normal">
                    {game.count}
                  </span>
                </LibraryLink>
              )}
            </For>
          </nav>

          <div class="py-7 sm:py-9">
            <h1 class="font-display text-[clamp(42px,4.6vw,64px)] leading-[0.92] font-extrabold tracking-[0.005em] text-steel-hi uppercase">
              {info().library.title}
            </h1>
            <p class="mt-5 max-w-[500px] text-base text-fg-2 sm:text-[17px]">
              {info().library.lead}
            </p>
            <SearchForm
              action={info().libraryPath}
              placeholder="Search experiences by name, creator or code"
              label="Search experiences by name, creator or code"
              value={props.data.search.q}
              class="mt-7"
            />
          </div>

          <Show
            when={info().library.leadsWith === 'health'}
            fallback={
              <p class="flex flex-wrap gap-x-9 gap-y-1.5 border-t border-steel/15 py-3 text-[13.5px] text-fg-2">
                <span>
                  <b class="mr-1.5 font-display text-[21px] font-bold text-fg">
                    {props.data.stats.experiences}
                  </b>
                  experiences
                </span>
                <span>
                  <b class="mr-1.5 font-display text-[21px] font-bold text-fg">
                    {props.data.stats.newThisWeek}
                  </b>
                  new this week
                </span>
                <span>
                  <b class="mr-1.5 font-display text-[21px] font-bold text-fg">
                    {props.data.stats.creators}
                  </b>
                  creators
                </span>
              </p>
            }
          >
            {/* An archive leads with how much of it still loads: a bar, the
                count, and when the codes were last checked. */}
            <p class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-steel/15 py-3.5 text-[13px] text-fg-2">
              <span
                class="h-1 w-56 max-w-full bg-line-strong"
                aria-hidden="true"
              >
                <span
                  class="block h-full bg-accent"
                  style={{
                    width: `${props.data.stats.listed > 0 ? (100 * props.data.stats.experiences) / props.data.stats.listed : 0}%`,
                  }}
                />
              </span>
              <span>
                <b class="font-semibold text-fg">
                  {props.data.stats.experiences}
                </b>{' '}
                of {props.data.stats.listed} experiences still load in game.
                <Show when={props.data.stats.checkedAt}>
                  {(checked) => (
                    <span class="text-fg-3">
                      {' '}
                      Codes were last checked{' '}
                      <DateText value={checked()} now={props.data.now} />.
                    </span>
                  )}
                </Show>
              </span>
              <span class="ml-auto">
                <b class="font-semibold text-fg">{props.data.stats.creators}</b>{' '}
                creators
              </span>
            </p>
          </Show>
        </div>
      </section>

      <div class="wrap pt-7">
        <nav
          class="flex flex-wrap gap-x-[18px] gap-y-1 border-b border-line sm:gap-x-[26px]"
          aria-label="Category"
        >
          <For
            each={[
              {
                name: 'All',
                slug: undefined,
                count: props.data.stats.experiences,
              },
              ...props.data.categories,
            ]}
          >
            {(category) => (
              <LibraryLink
                game={props.data.game}
                search={{
                  ...address(),
                  category: category.slug,
                  page: undefined,
                }}
                keepScroll
                aria-current={
                  props.data.search.category === category.slug
                    ? 'true'
                    : undefined
                }
                class="-mb-px flex items-baseline gap-2 border-b-2 border-transparent pb-3 font-display text-[21px] leading-none font-bold tracking-[0.02em] text-fg-3 uppercase hover:text-fg aria-[current=true]:border-accent aria-[current=true]:text-steel-hi sm:text-2xl"
              >
                {category.name}
                <span class="font-mono text-[11.5px] font-normal tracking-normal text-fg-3">
                  {category.count}
                </span>
              </LibraryLink>
            )}
          </For>
        </nav>

        <LibraryFilters data={props.data} />

        <h2 class="sr-only">Experiences</h2>
        <Show
          when={shown() > 0}
          fallback={
            <p class="border border-line bg-surface-1 px-5 py-10 text-center text-fg-2">
              Nothing matches these filters.
            </p>
          }
        >
          <div class="grid gap-4 min-[680px]:grid-cols-2 min-[680px]:gap-5 min-[1100px]:grid-cols-4">
            <For each={props.data.items}>
              {(experience) => <ExperienceCard experience={experience} />}
            </For>
          </div>
        </Show>

        <div class="pb-20">
          <ShowMore
            shown={shown()}
            total={props.data.total}
            page={props.data.search.page}
            lastPage={MAX_PAGES}
          >
            {/* A real link to a longer page, so it works without script and
                a search engine can follow it. */}
            <LibraryLink
              game={props.data.game}
              search={{ ...address(), page: props.data.search.page + 1 }}
              keepScroll
              class={buttonGhost}
            >
              Show {Math.min(PAGE_SIZE, left())} more
            </LibraryLink>
          </ShowMore>
        </div>
      </div>
    </main>
  )
}
