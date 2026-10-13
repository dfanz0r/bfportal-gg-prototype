import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { Profile } from '../functions/profile'
import {
  FEED_MAX_PAGES,
  type ProfileTab,
  profileTabs,
} from '../shared/feed-search'
import { Avatar } from './avatar'
import { DateText } from './date-text'
import { ExperienceCard } from './experience-card'
import { Pills } from './pills'
import { ScriptRow } from './script-row'
import { ShowMore } from './show-more'
import { buttonGhost, pill } from './ui'

const TAB_LABELS: Record<ProfileTab, string> = {
  experiences: 'Experiences',
  scripts: 'Scripts',
  liked: 'Liked',
}

const ROLE_LABELS: Record<string, string> = {
  moderator: 'Moderator',
  admin: 'Admin',
}

/** The head of a profile. */
export function profileHead(data: Profile | undefined) {
  return {
    meta: [
      { title: `${data?.name ?? 'A creator'} · bfportal.gg` },
      // A profile is a list of someone's work, which the work's own pages
      // already cover for search.
      { name: 'robots', content: 'noindex' },
    ],
  }
}

/** A person's profile: who they are, and what they have shared and liked. */
export function ProfilePage(props: { data: Profile }) {
  const data = () => props.data
  const name = () => data().name ?? 'A creator'
  const shown = () => data().cards.length + data().scripts.length
  // The first tab is what the bare address shows.
  const tabInAddress = (tab: ProfileTab) =>
    tab === profileTabs[0] ? undefined : tab

  return (
    <main id="content">
      <section class="dot-grid border-b border-line bg-surface-1">
        <div class="wrap flex flex-wrap items-center gap-x-6 gap-y-4 py-6">
          <Avatar name={name()} image={data().image} class="size-16 text-xl" />
          <div class="min-w-0">
            <h1 class="font-display text-[clamp(34px,3.4vw,46px)] leading-[0.96] font-extrabold tracking-[0.005em] text-steel-hi uppercase [overflow-wrap:anywhere]">
              {name()}
            </h1>
            <p class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13.5px] text-fg-2">
              <Show when={ROLE_LABELS[data().role]}>
                {(role) => (
                  <span class="border-l-2 border-accent bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] tracking-[0.1em] text-fg uppercase">
                    {role()}
                  </span>
                )}
              </Show>
              <span>
                Joined <DateText value={data().joinedAt} />
              </span>
              <span>{data().counts.likesReceived} likes received</span>
              <span>{data().counts.updates} updates posted</span>
            </p>
          </div>
        </div>
      </section>

      <div class="wrap pt-7 pb-20">
        <Pills label="What to show">
          <For each={profileTabs}>
            {(tab) => (
              <Link
                to="/users/$discordId"
                params={{ discordId: data().discordId }}
                search={{ tab: tabInAddress(tab) }}
                resetScroll={false}
                class={pill}
                aria-current={data().tab === tab ? 'true' : undefined}
              >
                {TAB_LABELS[tab]}
                <span class="font-mono text-[11.5px] text-fg-3">
                  {data().counts[tab]}
                </span>
              </Link>
            )}
          </For>
        </Pills>

        <Show
          when={shown() > 0}
          fallback={
            <p class="mt-6 border border-line bg-surface-1 px-5 py-10 text-center text-fg-2">
              Nothing here yet.
            </p>
          }
        >
          <h2 class="sr-only">{TAB_LABELS[data().tab]}</h2>
          <Show when={data().cards.length > 0}>
            <div class="mt-6 grid gap-4 min-[680px]:grid-cols-2 min-[680px]:gap-5 min-[1100px]:grid-cols-4">
              <For each={data().cards}>
                {(card) => <ExperienceCard experience={card} />}
              </For>
            </div>
          </Show>
          <Show when={data().scripts.length > 0}>
            <ul class="mt-6 divide-y divide-line border border-line bg-surface-1">
              <For each={data().scripts}>
                {(script) => <ScriptRow script={script} />}
              </For>
            </ul>
          </Show>
          <ShowMore
            shown={shown()}
            total={data().counts[data().tab]}
            page={data().page}
            lastPage={FEED_MAX_PAGES}
          >
            <Link
              to="/users/$discordId"
              params={{ discordId: data().discordId }}
              search={{ tab: tabInAddress(data().tab), page: data().page + 1 }}
              resetScroll={false}
              class={buttonGhost}
            >
              Show more
            </Link>
          </ShowMore>
        </Show>
      </div>
    </main>
  )
}
