import { createFileRoute, Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import { PageLayout } from '../components/page-layout'
import { Pills } from '../components/pills'
import { ShowMore } from '../components/show-more'
import { buttonGhost, label, panel, pill } from '../components/ui'
import { UpdateCard } from '../components/update-card'
import { fetchUpdates } from '../functions/updates'
import {
  FEED_MAX_PAGES,
  type UpdatesSearch,
  updatesSearchSchema,
} from '../shared/feed-search'
import { gameList } from '../shared/games'

const LEAD =
  'Release notes, status reports and calls for testers, posted by creators on their own projects.'

export const Route = createFileRoute('/updates')({
  validateSearch: updatesSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchUpdates({ data: deps }),
  head: () => ({
    meta: [
      { title: 'Recent updates · bfportal.gg' },
      { name: 'description', content: LEAD },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  const search = () => data().search
  // A filter change starts again from the first page.
  const withFilter = (change: UpdatesSearch): UpdatesSearch => ({
    ...search(),
    page: undefined,
    ...change,
  })

  return (
    <PageLayout title="Recent updates" lead={LEAD}>
      <div class="flex flex-wrap gap-x-8 gap-y-3">
        <Pills label="Kind of project">
          <Link
            to="/updates"
            search={withFilter({ kind: undefined })}
            class={pill}
            aria-current={search().kind ? undefined : 'true'}
          >
            Everything
          </Link>
          <Link
            to="/updates"
            search={withFilter({ kind: 'experience' })}
            class={pill}
            aria-current={search().kind === 'experience' ? 'true' : undefined}
          >
            Experiences
          </Link>
          <Link
            to="/updates"
            search={withFilter({ kind: 'script', game: undefined })}
            class={pill}
            aria-current={search().kind === 'script' ? 'true' : undefined}
          >
            Scripts
          </Link>
        </Pills>
        {/* Scripts belong to no game, so there is nothing to choose. */}
        <Show when={search().kind !== 'script'}>
          <Pills label="Game">
            <Link
              to="/updates"
              search={withFilter({ game: undefined })}
              class={pill}
              aria-current={search().game ? undefined : 'true'}
            >
              Any game
            </Link>
            <For each={gameList}>
              {(game) => (
                <Link
                  to="/updates"
                  search={withFilter({ game: game.id })}
                  class={pill}
                  aria-current={search().game === game.id ? 'true' : undefined}
                >
                  {game.name}
                </Link>
              )}
            </For>
          </Pills>
        </Show>
      </div>

      <Show
        when={data().items.length > 0}
        fallback={
          <p class="mt-6 border border-line bg-surface-1 px-5 py-10 text-center text-fg-2">
            No updates match.
          </p>
        }
      >
        <div class="mt-4 grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_348px] min-[1100px]:gap-10">
          <div class="min-w-0 border-t border-line">
            <For each={data().items}>
              {(update) => <UpdateCard update={update} now={data().now} row />}
            </For>
          </div>
          <aside class={`${panel} p-5`}>
            <h2 class={`${label} mb-3`}>Posting updates</h2>
            <p class="text-[13.5px] leading-[1.45] text-fg-2">
              Owners and listed creators can post from their project's page. A
              moderator looks at each update before it appears here.
            </p>
          </aside>
        </div>
        <ShowMore
          shown={data().items.length}
          total={data().total}
          page={search().page ?? 1}
          lastPage={FEED_MAX_PAGES}
        >
          <Link
            to="/updates"
            search={{ ...search(), page: (search().page ?? 1) + 1 }}
            resetScroll={false}
            class={buttonGhost}
          >
            Show more
          </Link>
        </ShowMore>
      </Show>
    </PageLayout>
  )
}
