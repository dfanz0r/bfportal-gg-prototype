import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { Profile } from '../functions/profile'
import {
  FEED_MAX_PAGES,
  type ProfileTab,
  profileTabs,
} from '../shared/feed-search'
import { ExperienceCard } from './cards/experience-card'
import { SnippetRow } from './cards/snippet-row'
import { Avatar } from './ui/avatar'
import { DateText } from './ui/date-text'
import { ShowMore } from './ui/show-more'
import { Tabs } from './ui/tabs'
import { buttonGhost } from './ui/ui'

const TAB_LABELS: Record<ProfileTab, string> = {
  experiences: 'Experiences',
  snippets: 'Snippets',
  liked: 'Liked',
}

const ROLE_LABELS: Record<string, string> = {
  moderator: 'Moderator',
  admin: 'Admin',
}

/** A small boxed word or two under the name: a role, when they joined. */
const badge =
  'border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] tracking-[0.1em] text-fg-2 uppercase'

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
  const shown = () => data().cards.length + data().snippets.length
  // The first tab is what the bare address shows.
  const tabInAddress = (tab: ProfileTab) =>
    tab === profileTabs[0] ? undefined : tab
  const stats = (): [number, string][] => [
    [data().counts.experiences, 'experiences'],
    [data().counts.snippets, 'snippets'],
    [data().counts.likesReceived, 'likes received'],
    [data().counts.updates, 'updates posted'],
  ]

  return (
    <main id="content">
      <section class="dot-grid border-b border-line bg-surface-1">
        <div class="wrap pt-6">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-4">
            <Avatar
              name={name()}
              image={data().image}
              class="size-[72px] text-2xl"
            />
            <div class="min-w-0">
              <h1 class="font-display text-[clamp(34px,3.4vw,46px)] leading-[0.96] font-extrabold tracking-[0.005em] text-steel-hi uppercase [overflow-wrap:anywhere]">
                {name()}
              </h1>
              <p class="mt-2.5 flex flex-wrap items-center gap-2">
                <Show when={ROLE_LABELS[data().role]}>
                  {(role) => (
                    <span class={`${badge} border-l-2 border-l-accent`}>
                      {role()}
                    </span>
                  )}
                </Show>
                <span class={badge}>
                  Joined <DateText value={data().joinedAt} />
                </span>
              </p>
            </div>
          </div>
          <p class="mt-5 flex flex-wrap gap-x-9 gap-y-1.5 border-t border-steel/15 py-3 text-[13.5px] text-fg-2">
            <For each={stats()}>
              {([value, what]) => (
                <span>
                  <b class="mr-1.5 font-display text-[21px] font-bold text-fg">
                    {value}
                  </b>
                  {what}
                </span>
              )}
            </For>
          </p>
        </div>
      </section>

      <div class="wrap pt-7 pb-20">
        <Tabs
          label="What to show"
          items={profileTabs.map((tab) => ({
            name: TAB_LABELS[tab],
            href: `/users/${data().discordId}${tabInAddress(tab) ? `?tab=${tab}` : ''}`,
            count: data().counts[tab],
            current: data().tab === tab,
          }))}
        />

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
          <Show when={data().snippets.length > 0}>
            <ul class="mt-6 divide-y divide-line border border-line bg-surface-1">
              <For each={data().snippets}>
                {(snippet) => <SnippetRow snippet={snippet} />}
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
