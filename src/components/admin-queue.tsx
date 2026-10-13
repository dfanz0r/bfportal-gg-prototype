import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { Queue } from '../functions/moderation'
import { experienceTypeLabels } from '../shared/content'
import { gameInfo } from '../shared/games'
import { Avatar } from './avatar'
import { DateText } from './date-text'
import { PageLayout } from './page-layout'
import { buttonGhost, panel, tag } from './ui'

/** The moderators' queue: everything waiting, the longest wait first. */
export function AdminQueue(props: { data: Queue }) {
  const data = () => props.data

  return (
    <PageLayout
      title="Review queue"
      lead="Nothing below is public until someone here approves it."
    >
      <Show
        when={data().items.length > 0}
        fallback={
          <p class={`${panel} px-5 py-10 text-center text-fg-2`}>
            Nothing is waiting.
          </p>
        }
      >
        <ul class={`${panel} divide-y divide-line`}>
          <For each={data().items}>
            {(item) => (
              <li class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                <span class={`${tag} border-steel/40 text-steel-hi`}>New</span>
                <div class="min-w-0 flex-1 basis-64">
                  <p class="truncate text-[15px] font-semibold">{item.title}</p>
                  <p class="text-[13.5px] text-fg-2">
                    {gameInfo(item.game).name}
                    <Show when={item.isTemplate}>. Template</Show>
                    <Show when={item.types.length > 0}>
                      . Built with{' '}
                      {item.types
                        .map((type) => experienceTypeLabels[type].toLowerCase())
                        .join(', ')}
                    </Show>
                    .
                  </p>
                </div>
                <Show when={item.sameCode}>
                  <span class={`${tag} border-warn/50 text-warn`}>
                    Code already listed
                  </span>
                </Show>
                <span class="inline-flex items-center gap-2 text-[13px] text-fg-2">
                  <Avatar
                    name={item.ownerName}
                    image={item.ownerImage}
                    class="size-5 text-[9px]"
                  />
                  {item.ownerName}
                </span>
                <span class="font-mono text-xs text-fg-3">
                  <DateText value={item.submittedAt} now={data().now} />
                </span>
                <Link
                  to="/admin/review/$id"
                  params={{ id: String(item.id) }}
                  class={`${buttonGhost} h-[34px] px-3.5`}
                >
                  Review
                </Link>
              </li>
            )}
          </For>
        </ul>
        <p class="mt-3 text-[13px] text-fg-3">
          <Show
            when={data().total > data().items.length}
            fallback={`${data().total} waiting.`}
          >
            The {data().items.length} that have waited longest, of{' '}
            {data().total}. The rest appear as these are decided.
          </Show>
        </p>
      </Show>
    </PageLayout>
  )
}
