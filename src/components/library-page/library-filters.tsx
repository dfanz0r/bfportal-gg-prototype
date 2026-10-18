import { For, type JSX, Show } from 'solid-js'

import type { Library } from '../../functions/library'
import { experienceTypeLabels } from '../../shared/content'
import { gameInfo } from '../../shared/games'
import {
  type LibrarySearch,
  librarySearchSchema,
  librarySorts,
  playerRanges,
} from '../../shared/library-search'
import { FilterToggle } from '../forms/filter-toggle'
import { createDismiss } from '../ui/dismiss'
import { createHydrated } from '../ui/hydrated'
import { Icon } from '../ui/icon'
import { LibraryLink, useLibraryNavigate } from '../ui/library-link'
import { buttonSteel, filterControl, filterSelect } from '../ui/ui'

const SORT_LABELS = {
  trending: 'Trending this week',
  newest: 'Newest',
  likes: 'Most liked, all time',
} as const

/** A filter with several choices, opening under its button. */
function Menu(props: { label: string; chosen: number; children: JSX.Element }) {
  const dismiss = createDismiss({ staysOpen: true })
  return (
    <details class="relative" ref={dismiss}>
      <summary class={filterControl}>
        {props.label}
        <Show when={props.chosen > 0}>
          <span class="bg-accent px-1.5 font-mono text-[11px] text-accent-ink">
            {props.chosen}
          </span>
        </Show>
        <Icon name="chevron-down" class="size-3.5 text-fg-3" />
      </summary>
      <div class="absolute top-[38px] left-0 z-20 max-h-80 w-64 overflow-y-auto border border-line-strong bg-surface-1 p-2 shadow-[0_8px_30px_rgb(0_0_0/0.6)]">
        {props.children}
      </div>
    </details>
  )
}

/**
 * The Library's filters. It is one GET form, so it works before the page's
 * script has loaded; once it has, a change applies itself and the Apply button
 * goes away.
 *
 * Which filters there are comes from the game: its tag groups, and what the
 * registry says it supports.
 */
export function LibraryFilters(props: { data: Library }) {
  const hydrated = createHydrated()
  const go = useLibraryNavigate()
  const info = () => gameInfo(props.data.game)
  const search = () => props.data.search
  const chosen = (slug: string) => search().tag?.includes(slug) ?? false
  const ownGroups = () => props.data.tagGroups.filter((group) => group.own)
  const sharedGroups = () => props.data.tagGroups.filter((group) => !group.own)
  const chosenIn = (groups: Library['tagGroups']) =>
    groups.flatMap((group) => group.tags).filter((tag) => chosen(tag.slug))
      .length
  const filtered = () =>
    Boolean(
      search().q ||
        search().category ||
        search().tag ||
        search().built ||
        search().players ||
        search().featured ||
        search().templates ||
        search().free ||
        search().xp ||
        search().unavailable,
    )

  const read = (form: HTMLFormElement): LibrarySearch => {
    const data = new FormData(form)
    const flag = (name: string) =>
      data.get(name) === 'true' ? true : undefined
    const sort = data.get('sort')
    const read = librarySearchSchema.safeParse({
      q: data.get('q') || undefined,
      category: data.get('category') || undefined,
      tag: data.getAll('tag'),
      built: data.getAll('built'),
      players: data.get('players') || undefined,
      featured: flag('featured'),
      templates: flag('templates'),
      free: flag('free'),
      xp: flag('xp'),
      unavailable: flag('unavailable'),
      // The game's own order needs no place in the address.
      sort: sort === info().library.sort ? undefined : sort,
    })
    return read.success ? read.data : {}
  }
  const apply = (event: Event & { currentTarget: HTMLFormElement }) => {
    event.preventDefault()
    void go(props.data.game, read(event.currentTarget))
  }

  return (
    <form
      method="get"
      action={info().libraryPath}
      onChange={apply}
      onSubmit={apply}
      aria-label="Filters"
    >
      <Show when={search().q}>
        {(q) => <input type="hidden" name="q" value={q()} />}
      </Show>
      <Show when={search().category}>
        {(category) => (
          <input type="hidden" name="category" value={category()} />
        )}
      </Show>

      <div class="flex flex-wrap items-center gap-2 pt-3.5">
        <For each={ownGroups()}>
          {(group) => (
            <Menu label={group.name} chosen={chosenIn([group])}>
              <For each={group.tags}>
                {(tag) => (
                  <FilterToggle
                    name="tag"
                    value={tag.slug}
                    checked={chosen(tag.slug)}
                  >
                    {tag.name}
                  </FilterToggle>
                )}
              </For>
            </Menu>
          )}
        </For>
        <Show when={sharedGroups().length > 0}>
          <Menu label="Tags" chosen={chosenIn(sharedGroups())}>
            <For each={sharedGroups()}>
              {(group) => (
                <fieldset class="mb-2 last:mb-0">
                  <legend class="px-0.5 pb-1 font-mono text-[11px] tracking-[0.14em] text-fg-3 uppercase">
                    {group.name}
                  </legend>
                  <div class="grid">
                    <For each={group.tags}>
                      {(tag) => (
                        <FilterToggle
                          name="tag"
                          value={tag.slug}
                          checked={chosen(tag.slug)}
                        >
                          {tag.name}
                        </FilterToggle>
                      )}
                    </For>
                  </div>
                </fieldset>
              )}
            </For>
          </Menu>
        </Show>
        <label class={filterControl}>
          Lobby size
          <select name="players" class={filterSelect} aria-label="Lobby size">
            <option value="" selected={!search().players}>
              Any
            </option>
            <For each={Object.entries(playerRanges)}>
              {([key, range]) => (
                <option value={key} selected={search().players === key}>
                  {range.label}
                </option>
              )}
            </For>
          </select>
        </label>

        <span class="mx-1 h-5 w-px bg-line max-sm:hidden" aria-hidden="true" />

        <FilterToggle name="featured" checked={search().featured ?? false}>
          Featured
        </FilterToggle>
        {/* Where there is nothing to build with, templates are a category. */}
        <Show when={info().builtWith.length > 0}>
          <FilterToggle name="templates" checked={search().templates ?? false}>
            Templates
          </FilterToggle>
        </Show>
        <Show when={info().hasFreeVersion}>
          <FilterToggle name="free" checked={search().free ?? false}>
            Free to play
          </FilterToggle>
        </Show>
        <FilterToggle name="xp" checked={search().xp ?? false}>
          Full XP
        </FilterToggle>
        <FilterToggle
          name="unavailable"
          checked={search().unavailable ?? false}
        >
          Show ones that no longer load
        </FilterToggle>

        <label class={`${filterControl} sm:ml-auto`}>
          Sort by
          <select name="sort" class={filterSelect} aria-label="Sort by">
            <For each={librarySorts}>
              {(sort) => (
                <option value={sort} selected={search().sort === sort}>
                  {SORT_LABELS[sort]}
                </option>
              )}
            </For>
          </select>
        </label>
      </div>

      <Show when={info().builtWith.length > 0}>
        <div class="flex flex-wrap items-center gap-x-3.5 gap-y-2 pt-3 text-[13.5px] text-fg-3">
          <span>Built with</span>
          <For each={info().builtWith}>
            {(type) => (
              <FilterToggle
                name="built"
                value={type}
                checked={search().built?.includes(type) ?? false}
              >
                {experienceTypeLabels[type]}
              </FilterToggle>
            )}
          </For>
        </div>
      </Show>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3.5 pb-5 text-[13.5px] text-fg-2">
        <p>
          <b class="font-semibold text-fg">{props.data.total}</b>{' '}
          {props.data.total === 1 ? 'experience' : 'experiences'}
        </p>
        <Show when={filtered()}>
          <LibraryLink
            game={props.data.game}
            keepScroll
            class="text-steel-hi underline hover:text-fg"
          >
            Clear filters
          </LibraryLink>
        </Show>
        {/* Until the script takes over, the form needs a button. */}
        <Show when={!hydrated()}>
          <button type="submit" class={`${buttonSteel} h-[34px] px-3.5`}>
            Apply
          </button>
        </Show>
      </div>
    </form>
  )
}
