import { Link } from '@tanstack/solid-router'
import { For, Match, Show, Switch } from 'solid-js'

import type { AdminSnippets as List } from '../functions/admin-content'
import {
  ADMIN_MAX_PAGES,
  ADMIN_PAGE,
  type AdminSnippetsSearch,
  adminSnippetsSearchSchema,
} from '../shared/admin-search'
import { FilterForm } from './forms/filter-form'
import { FilterSearch } from './forms/filter-search'
import { PageHead } from './layout/page-head'
import { cell, DataTable } from './ui/data-table'
import { ListedButton } from './ui/listed-button'
import { ShowMore } from './ui/show-more'
import { SpotlightSwitch } from './ui/spotlight-switch'
import { StatusTabs } from './ui/status-tabs'
import { StatusTag } from './ui/status-tag'
import { buttonGhost, filterControl, filterSelect, panel } from './ui/ui'

/**
 * Every snippet sent in, whatever its state: to find one, see where it
 * stands, and delist it or list it again. An admin features it, or marks it
 * trending, here.
 */
export function AdminSnippets(props: {
  data: List
  search: AdminSnippetsSearch
  isAdmin: boolean
}) {
  const data = () => props.data

  return (
    <>
      <PageHead
        bare
        title="Snippets"
        lead="Every snippet sent in, whatever its state. Featured and trending are set by admins and apply at once."
      />
      <StatusTabs
        path="/admin/snippets"
        search={props.search}
        counts={data().counts}
      />
      <FilterForm
        schema={adminSnippetsSearchSchema}
        class="flex flex-wrap items-center gap-2 py-4"
      >
        <Show when={props.search.status}>
          {(status) => <input type="hidden" name="status" value={status()} />}
        </Show>
        <FilterSearch
          value={props.search.q}
          placeholder="Title or owner"
          class="w-full sm:w-72"
        />
        <label class={`${filterControl} sm:ml-auto`}>
          Sort by
          <select name="sort" class={filterSelect}>
            <option value="" selected={!props.search.sort}>
              Newest
            </option>
            <option value="likes" selected={props.search.sort === 'likes'}>
              Most liked
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
          label="Snippets"
          minWidth={860}
          columns={[
            { name: 'Snippet' },
            { name: 'Category' },
            { name: 'Status' },
            { name: 'Owner' },
            { name: 'Likes', numeric: true },
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
                    href={`/snippets/${row.slug}`}
                    class="font-semibold hover:text-accent"
                  >
                    {row.title}
                  </a>
                </td>
                <td class={`${cell} text-fg-2`}>{row.category}</td>
                <td class={cell}>
                  <StatusTag status={row.status} />
                </td>
                <td class={`${cell} text-fg-2`}>{row.owner}</td>
                <td class={`${cell} text-right font-mono`}>{row.likes}</td>
                <td class={cell}>
                  <SpotlightSwitch
                    kind="snippet"
                    slug={row.slug}
                    title={row.title}
                    field="featured"
                    on={row.featured}
                    canChange={props.isAdmin}
                  />
                </td>
                <td class={cell}>
                  <SpotlightSwitch
                    kind="snippet"
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
                      {/* A snippet is reviewed on its own page. */}
                      <Match when={row.status === 'pending'}>
                        <a
                          href={`/snippets/${row.slug}`}
                          class={`${buttonGhost} h-[34px] px-3 text-xs`}
                        >
                          Review
                        </a>
                      </Match>
                      <Match
                        when={
                          row.status === 'published' ||
                          row.status === 'unpublished'
                        }
                      >
                        <ListedButton
                          kind="snippet"
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
            to="/admin/snippets"
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
