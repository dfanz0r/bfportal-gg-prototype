import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { Playtests } from '../functions/playtests'
import { links } from '../shared/links'
import { PageLayout } from './layout/page-layout'
import { PlaytestRow } from './playtest-list/playtest-row'
import { DateText } from './ui/date-text'
import { Icon } from './ui/icon'
import { Tabs } from './ui/tabs'
import { buttonGhost, label, panel } from './ui/ui'

const LEAD =
  'Experiences their creators want tested. Grab the code, play, and report what you find.'

const STEPS = [
  ['A creator posts a brief:', 'what it is, what to try, what to report.'],
  [
    'Testers in the chosen regions',
    'are pinged in Discord, and it shows up here.',
  ],
  ['You play it', 'with the code, whenever suits you.'],
  [
    'You report back',
    "in the playtest's Discord thread. The creator closes it and posts what changed.",
  ],
]

/** The head of the playtests page. */
export function playtestListHead() {
  return {
    meta: [
      { title: 'Playtests · bfportal.gg' },
      { name: 'description', content: LEAD },
    ],
  }
}

/** The playtests open now, how playtesting works, and those just closed. */
export function PlaytestList(props: { data: Playtests }) {
  const data = () => props.data

  return (
    <PageLayout title="Playtests" lead={LEAD}>
      <div class="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_348px] min-[1100px]:gap-10">
        <div class="min-w-0">
          <Tabs
            label="Playtests and events"
            items={[
              {
                name: 'Playtests',
                href: '/playtests',
                count: data().open.total,
                current: true,
              },
              { name: 'Community events', href: '/events' },
            ]}
          />
          <Show
            when={data().open.items.length > 0}
            fallback={
              <p class="mt-6 border border-line bg-surface-1 px-5 py-10 text-center text-fg-2">
                No playtests are open right now.
              </p>
            }
          >
            <ul class="divide-y divide-line border-b border-line">
              <For each={data().open.items}>
                {(playtest) => <PlaytestRow playtest={playtest} />}
              </For>
            </ul>
          </Show>
        </div>

        <aside class="grid gap-4">
          <div class={`${panel} p-5`}>
            <h2 class={`${label} mb-3`}>How it works</h2>
            <ol class="grid gap-3">
              <For each={STEPS}>
                {([lead, rest], index) => (
                  <li class="flex gap-3 text-[13.5px] leading-[1.45] text-fg-2">
                    <span class="grid size-5 shrink-0 place-items-center border border-line-strong font-mono text-[11px] text-fg">
                      {index() + 1}
                    </span>
                    <span>
                      <b class="font-semibold text-fg">{lead}</b> {rest}
                    </span>
                  </li>
                )}
              </For>
            </ol>
          </div>

          <div class={`${panel} grid gap-3 p-5`}>
            <h2 class={label}>Get pinged for new ones</h2>
            <p class="text-[13.5px] leading-[1.45] text-fg-2">
              Take the Tester role for your region in the Discord server. New
              playtests for that region mention it.
            </p>
            <a href={links.discord} class={`${buttonGhost} h-9 text-xs`}>
              <Icon name="discord" />
              Open the Discord server
            </a>
          </div>

          <Show when={data().closed.items.length > 0}>
            <div class={`${panel} p-5`}>
              <h2 class={`${label} mb-1`}>Recently closed</h2>
              <ul class="divide-y divide-line">
                <For each={data().closed.items}>
                  {(playtest) => (
                    <li class="py-2.5 last:pb-0">
                      <Link
                        to="/playtests/$id"
                        params={{ id: String(playtest.id) }}
                        class="text-sm font-semibold hover:text-accent-hi"
                      >
                        {playtest.name}
                      </Link>
                      <p class="text-[12.5px] text-fg-3">
                        <Show when={playtest.closesAt} fallback="Closed">
                          {(closed) => (
                            <>
                              Closed <DateText value={closed()} />
                            </>
                          )}
                        </Show>
                        <Show when={playtest.hasResult}>. Results posted</Show>
                      </p>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          </Show>
        </aside>
      </div>
    </PageLayout>
  )
}
