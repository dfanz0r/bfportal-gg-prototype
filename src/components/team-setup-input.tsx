import { createEffect, createSignal, For, on, Show } from 'solid-js'
import { createStore } from 'solid-js/store'

import { MAX_TEAMS, type TeamSetup, teamTotals } from '../shared/teams'
import { FieldError } from './field-error'
import { createHydrated } from './hydrated'
import { Icon } from './icon'
import { Slider } from './slider'
import { buttonGhost, iconButton, label, panel } from './ui'

type Team = TeamSetup[number]

const teamName =
  'text-[13px] font-semibold tracking-[0.04em] text-fg-2 uppercase'

/**
 * How an experience splits its players into teams: a row for each team, with
 * the people and the bots on it. A team can be all bots. Each row sends one
 * `teamPlayers` and one `teamBots`, in order.
 *
 * Adding and removing a team is the script's. With no script the teams the
 * form starts with can still be set.
 */
export function TeamSetupInput(props: {
  teams: TeamSetup
  /** The most players, and the most bots, a match of this game holds. */
  max: number
  gameName: string
  error?: string
}) {
  const hydrated = createHydrated()
  let next = 0
  const rowsOf = (teams: TeamSetup) =>
    teams.map((team) => ({ id: next++, start: team }))
  const [rows, setRows] = createSignal(rowsOf(props.teams))
  // What each row is set to now, by its id.
  const [now, setNow] = createStore<Record<number, Team>>({})
  const remember = (list: { id: number; start: Team }[]) => {
    for (const row of list) setNow(row.id, { ...row.start })
  }
  remember(rows())
  // Going to the other game's form starts the teams again from what it says.
  createEffect(
    on(
      () => props.teams,
      (teams) => {
        const list = rowsOf(teams)
        remember(list)
        setRows(list)
      },
      { defer: true },
    ),
  )
  const totals = () => teamTotals(rows().map((row) => now[row.id] ?? row.start))

  let list: HTMLDivElement | undefined
  // The form reads its fields as they are typed in. A team added or taken
  // away changes them too.
  const changed = () =>
    queueMicrotask(() =>
      list?.dispatchEvent(new Event('input', { bubbles: true })),
    )
  const add = () => {
    const last = rows().at(-1)
    // A copy of the last team, so a lobby of many equal teams is quick to
    // set out.
    const team = (last && now[last.id]) ?? { players: 1, bots: 0 }
    const row = { id: next++, start: { ...team } }
    remember([row])
    setRows((list) => [...list, row])
    changed()
  }
  const remove = (id: number) => {
    setRows((list) => list.filter((row) => row.id !== id))
    changed()
  }

  return (
    <div ref={list} class="grid gap-2">
      <div
        class="hidden grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_36px] gap-x-4 px-3 sm:grid"
        aria-hidden="true"
      >
        <span />
        <span class={label}>Players</span>
        <span class={label}>Bots</span>
      </div>
      <For each={rows()}>
        {(row, index) => (
          // One row on a wide window. On a narrow one the name and the
          // button to remove it share the first line, and each slider has
          // a line of its own.
          <div
            class={`${panel} grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-3 py-2.5 sm:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_36px]`}
          >
            <span class={teamName}>Team {index() + 1}</span>
            <Show when={hydrated() && rows().length > 1}>
              <button
                type="button"
                aria-label={`Remove team ${index() + 1}`}
                onClick={() => remove(row.id)}
                class={`${iconButton} max-sm:col-start-2 max-sm:row-start-1 sm:col-start-4 sm:row-start-1`}
              >
                <Icon name="x" class="size-4" />
              </button>
            </Show>
            <div class="max-sm:col-span-2 sm:col-start-2 sm:row-start-1">
              <Slider
                id={`team-${row.id}-players`}
                name="teamPlayers"
                label={`Team ${index() + 1} players`}
                icon="users"
                min={0}
                max={props.max}
                value={row.start.players}
                onValue={(players) => setNow(row.id, 'players', players)}
              />
            </div>
            <div class="max-sm:col-span-2 sm:col-start-3 sm:row-start-1">
              <Slider
                id={`team-${row.id}-bots`}
                name="teamBots"
                label={`Team ${index() + 1} bots`}
                icon="bot"
                min={0}
                max={props.max}
                value={row.start.bots}
                onValue={(bots) => setNow(row.id, 'bots', bots)}
              />
            </div>
          </div>
        )}
      </For>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        <Show
          when={hydrated() && rows().length < Math.min(MAX_TEAMS, props.max)}
        >
          <button type="button" onClick={add} class={buttonGhost}>
            <Icon name="plus" />
            Add a team
          </button>
        </Show>
        <p class="text-[13px] text-fg-3">
          {totals().players} {totals().players === 1 ? 'player' : 'players'}
          {totals().bots > 0
            ? ` and ${totals().bots} ${totals().bots === 1 ? 'bot' : 'bots'}`
            : ''}{' '}
          in all. A {props.gameName} match holds up to {props.max} players.
        </p>
      </div>
      <FieldError message={props.error} />
    </div>
  )
}
