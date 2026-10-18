import { Link } from '@tanstack/solid-router'
import { For, Match, Show, Switch } from 'solid-js'

import type { AdminExperiences as List } from '../functions/admin-content'
import {
  ADMIN_MAX_PAGES,
  ADMIN_PAGE,
  type AdminExperiencesSearch,
  adminExperiencesSearchSchema,
  healthFlagLabels,
  healthFlags,
} from '../shared/admin-search'
import { games } from '../shared/content'
import { gameInfo } from '../shared/games'
import { FilterForm } from './forms/filter-form'
import { FilterSearch } from './forms/filter-search'
import { FilterToggle } from './forms/filter-toggle'
import { PageHead } from './layout/page-head'
import { cell, DataTable } from './ui/data-table'
import { FlagTags } from './ui/flag-tags'
import { ListedButton } from './ui/listed-button'
import { ShowMore } from './ui/show-more'
import { SpotlightSwitch } from './ui/spotlight-switch'
import { StatusTabs } from './ui/status-tabs'
import { StatusTag } from './ui/status-tag'
import { buttonGhost, filterControl, filterSelect, panel } from './ui/ui'

/**
 * Every experience sent in, whatever its state: to find one, see where it
 * stands, and delist it or list it again. An admin features it, or marks it
 * trending, here.
 */
export function AdminExperiences(props: {
  data: List
  search: AdminExperiencesSearch
  isAdmin: boolean
}) {
  const data = () => props.data

  return (
    <>
      <PageHead
        bare
        title="Experiences"
        lead="Every experience sent in, whatever its state. Featured and trending are set by admins and apply at once."
      />
      <StatusTabs
        path="/admin/experiences"
        search={props.search}
        counts={data().counts}
      />
      <FilterForm
        schema={adminExperiencesSearchSchema}
        class="flex flex-wrap items-center gap-2 py-4"
      >
        <Show when={props.search.status}>
          {(status) => <input type="hidden" name="status" value={status()} />}
        </Show>
        <FilterSearch
          value={props.search.q}
          placeholder="Title, code or owner"
          class="w-full sm:w-72"
        />
        <label class={filterControl}>
          Game
          <select name="game" class={filterSelect}>
            <option value="" selected={!props.search.game}>
              Any
            </option>
            <For each={games}>
              {(game) => (
                <option value={game} selected={props.search.game === game}>
                  {gameInfo(game).name}
                </option>
              )}
            </For>
          </select>
        </label>
        <label class={filterControl}>
          Flags
          <select name="flag" class={filterSelect}>
            <option value="" selected={!props.search.flag}>
              Any
            </option>
            <For each={healthFlags}>
              {(flag) => (
                <option value={flag} selected={props.search.flag === flag}>
                  {healthFlagLabels[flag]}
                </option>
              )}
            </For>
          </select>
        </label>
        <FilterToggle name="featured" checked={props.search.featured ?? false}>
          Featured
        </FilterToggle>
        <FilterToggle name="trending" checked={props.search.trending ?? false}>
          Trending
        </FilterToggle>
        <FilterToggle name="reported" checked={props.search.reported ?? false}>
          Has reports
        </FilterToggle>
        <label class={`${filterControl} xl:ml-auto`}>
          Sort by
          <select name="sort" class={filterSelect}>
            <option value="" selected={!props.search.sort}>
              Newest
            </option>
            <option value="likes" selected={props.search.sort === 'likes'}>
              Most liked
            </option>
            <option value="reports" selected={props.search.sort === 'reports'}>
              Most reports
            </option>
          </select>
        </label>
      </FilterForm>

      <Show
        when={data().items.length > 0}
        fallback={
          <p class={`${panel} px-5 py-10 text-center text-fg-2`}>
            Nothing matches.
          </p>
        }
      >
        <DataTable
          label="Experiences"
          minWidth={1060}
          columns={[
            { name: 'Experience' },
            { name: 'Game' },
            { name: 'Status' },
            { name: 'Owner' },
            { name: 'Likes', numeric: true },
            { name: 'Reports', numeric: true },
            { name: 'Flags' },
            { name: 'Featured' },
            { name: 'Trending' },
            { name: 'Actions', hidden: true },
          ]}
        >
          <For each={data().items}>
            {(row) => (
              <tr>
                <td class={cell}>
                  <a
                    href={`/experiences/${row.slug}`}
                    class="font-semibold hover:text-accent"
                  >
                    {row.title}
                  </a>
                  <Show when={row.code}>
                    {(code) => (
                      <p class="font-mono text-xs text-fg-3">{code()}</p>
                    )}
                  </Show>
                </td>
                <td class={`${cell} whitespace-nowrap text-fg-2`}>
                  {gameInfo(row.game).name}
                </td>
                <td class={cell}>
                  <StatusTag status={row.status} />
                </td>
                <td class={`${cell} text-fg-2`}>{row.owner}</td>
                <td class={`${cell} text-right font-mono`}>{row.likes}</td>
                <td
                  class={`${cell} text-right font-mono ${row.reports > 0 ? 'text-warn' : 'text-fg-3'}`}
                >
                  {row.reports || '·'}
                </td>
                <td class={cell}>
                  <FlagTags flags={row.flags} />
                </td>
                <td class={cell}>
                  <SpotlightSwitch
                    kind="experience"
                    slug={row.slug}
                    title={row.title}
                    field="featured"
                    on={row.featured}
                    canChange={props.isAdmin}
                  />
                </td>
                <td class={cell}>
                  <SpotlightSwitch
                    kind="experience"
                    slug={row.slug}
                    title={row.title}
                    field="trending"
                    on={row.trending}
                    canChange={props.isAdmin}
                  />
                </td>
                <td class={cell}>
                  <div class="flex justify-end">
                    <Switch>
                      <Match when={row.status === 'pending'}>
                        <Link
                          to="/admin/review/$id"
                          params={{ id: String(row.id) }}
                          class={`${buttonGhost} h-[34px] px-3 text-xs`}
                        >
                          Review
                        </Link>
                      </Match>
                      <Match
                        when={
                          row.status === 'published' ||
                          row.status === 'unpublished'
                        }
                      >
                        <ListedButton
                          kind="experience"
                          slug={row.slug}
                          listed={row.status === 'published'}
                        />
                      </Match>
                    </Switch>
                  </div>
                </td>
              </tr>
            )}
          </For>
        </DataTable>
        <ShowMore
          shown={data().items.length}
          total={data().total}
          page={data().page}
          lastPage={ADMIN_MAX_PAGES}
        >
          <Link
            to="/admin/experiences"
            search={{ ...props.search, page: data().page + 1 }}
            resetScroll={false}
            class={buttonGhost}
          >
            Show {ADMIN_PAGE} more
          </Link>
        </ShowMore>
      </Show>
    </>
  )
}
