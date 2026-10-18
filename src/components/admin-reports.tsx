import { For, Show } from 'solid-js'

import { dismiss, type Reports, setFlags } from '../functions/admin-reports'
import {
  healthFlagLabels,
  type ReportsSearch,
  reportsSearchSchema,
  searchHref,
} from '../shared/admin-search'
import { games, reportTypes } from '../shared/content'
import { gameInfo } from '../shared/games'
import { FilterForm } from './forms/filter-form'
import { PageHead } from './layout/page-head'
import { cell, DataTable } from './ui/data-table'
import { DateText } from './ui/date-text'
import { createDismiss } from './ui/dismiss'
import { FlagTags } from './ui/flag-tags'
import { PostForm } from './ui/post-form'
import { Tabs } from './ui/tabs'
import { buttonGhost, filterControl, filterSelect, panel } from './ui/ui'

type Row = Reports['items'][number]

const small = `${buttonGhost} h-[34px] px-3 text-xs`

/** The flags as a moderator finds the experience, which deals with its reports. */
function SetFlags(props: { row: Row }) {
  const close = createDismiss()
  return (
    // Opened in the row, not over it: the table scrolls sideways, and its
    // scroll box would cut off anything placed over the rows.
    <details ref={close}>
      <summary class={`${small} list-none`}>Set flags</summary>
      <div class={`${panel} mt-2 w-44 p-3`}>
        <PostForm action={setFlags} class="grid gap-2">
          <input type="hidden" name="slug" value={props.row.slug} />
          <For
            each={
              [
                ['bugged', props.row.flags.bugged],
                ['broken', props.row.flags.broken],
                ['xpFarm', props.row.flags.xpFarm],
              ] as const
            }
          >
            {([name, checked]) => (
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={name}
                  value="true"
                  checked={checked}
                  class="accent-current"
                />
                {healthFlagLabels[name === 'xpFarm' ? 'xp_farm' : name]}
              </label>
            )}
          </For>
          <button type="submit" class={`${small} mt-1`}>
            Save
          </button>
        </PostForm>
      </div>
    </details>
  )
}

/**
 * What players have reported, by experience: open reports, or those dealt
 * with. A moderator sets the flags the reports point at, or dismisses them.
 */
export function AdminReports(props: { data: Reports; search: ReportsSearch }) {
  const data = () => props.data
  const open = () => props.search.state !== 'dismissed'
  const href = (state?: 'dismissed') =>
    searchHref('/admin/reports', { ...props.search, state })
  // The kind most reported, in each row, is the one to look at first.
  const most = (row: Row) => Math.max(...Object.values(row.reports))

  return (
    <>
      <PageHead
        bare
        title="Reports"
        lead="What players have reported. A report changes nothing by itself: a moderator sets the flags."
      />
      <Tabs
        label="Reports"
        items={[
          {
            name: 'Open',
            href: href(),
            count: data().counts.open,
            current: open(),
          },
          {
            name: 'Dealt with',
            href: href('dismissed'),
            count: data().counts.dismissed,
            current: !open(),
          },
        ]}
      />
      <FilterForm
        schema={reportsSearchSchema}
        class="flex flex-wrap items-center gap-2 py-4"
      >
        <Show when={props.search.state}>
          {(state) => <input type="hidden" name="state" value={state()} />}
        </Show>
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
          Kind
          <select name="kind" class={filterSelect}>
            <option value="" selected={!props.search.kind}>
              Any
            </option>
            <For each={reportTypes}>
              {(kind) => (
                <option value={kind} selected={props.search.kind === kind}>
                  {healthFlagLabels[kind]}
                </option>
              )}
            </For>
          </select>
        </label>
        <label class={`${filterControl} sm:ml-auto`}>
          Sort by
          <select name="sort" class={filterSelect}>
            <option value="" selected={!props.search.sort}>
              Most reports
            </option>
            <option value="latest" selected={props.search.sort === 'latest'}>
              Latest
            </option>
          </select>
        </label>
      </FilterForm>

      <Show
        when={data().items.length > 0}
        fallback={
          <p class={`${panel} px-5 py-10 text-center text-fg-2`}>
            {open() ? 'Nothing is reported.' : 'Nothing here yet.'}
          </p>
        }
      >
        <DataTable
          label="Reported experiences"
          minWidth={860}
          columns={[
            { name: 'Experience' },
            ...reportTypes.map((kind) => ({
              name: healthFlagLabels[kind],
              numeric: true,
            })),
            { name: open() ? 'Last report' : 'Dealt with' },
            { name: 'Flags now' },
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
                  <p class="text-[13px] text-fg-3">{gameInfo(row.game).name}</p>
                </td>
                <For each={reportTypes}>
                  {(kind) => (
                    <td
                      class={`${cell} text-right font-mono ${row.reports[kind] === 0 ? 'text-fg-3' : row.reports[kind] === most(row) ? 'text-warn' : ''}`}
                    >
                      {row.reports[kind] || '·'}
                    </td>
                  )}
                </For>
                <td class={`${cell} whitespace-nowrap text-fg-2`}>
                  <Show when={row.last}>
                    {(last) => <DateText value={last()} now={data().now} />}
                  </Show>
                </td>
                <td class={cell}>
                  <FlagTags flags={row.flags} none />
                </td>
                <td class={cell}>
                  <div class="flex items-start justify-end gap-1.5">
                    <SetFlags row={row} />
                    <Show when={open()}>
                      <PostForm action={dismiss}>
                        <input type="hidden" name="slug" value={row.slug} />
                        <button type="submit" class={small}>
                          Dismiss
                        </button>
                      </PostForm>
                    </Show>
                  </div>
                </td>
              </tr>
            )}
          </For>
        </DataTable>
        <p class="mt-3 text-[13px] text-fg-3">
          Setting the flags or dismissing deals with the reports. A new report
          opens them again.
        </p>
      </Show>
    </>
  )
}
