import { createFileRoute, Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import { PageLayout } from '../../components/page-layout'
import { Pills } from '../../components/pills'
import { ScriptRow } from '../../components/script-row'
import { ShowMore } from '../../components/show-more'
import { buttonGhost, pill } from '../../components/ui'
import { fetchScripts } from '../../functions/scripts'
import {
  FEED_MAX_PAGES,
  type ScriptsSearch,
  scriptsSearchSchema,
} from '../../shared/feed-search'

const LEAD =
  'Rules, logic and interface snippets for the Battlefield 6 Portal editor. Copy one into your experience, or use it as a starting point.'

export const Route = createFileRoute('/scripts/')({
  validateSearch: scriptsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchScripts({ data: deps }),
  head: () => ({
    meta: [
      { title: 'Scripts · bfportal.gg' },
      { name: 'description', content: LEAD },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  // What the address says now, without what is the default.
  const search = (): ScriptsSearch => ({
    category: data().category,
    sort: data().sort === 'newest' ? 'newest' : undefined,
  })

  return (
    <PageLayout title="Scripts" lead={LEAD}>
      <div class="flex flex-wrap items-center gap-x-8 gap-y-3">
        <Pills label="Category">
          <Link
            to="/scripts"
            search={{ ...search(), category: undefined }}
            class={pill}
            aria-current={data().category ? undefined : 'true'}
          >
            All
            <span class="font-mono text-[11.5px] text-fg-3">{data().all}</span>
          </Link>
          <For each={data().categories}>
            {(category) => (
              <Link
                to="/scripts"
                search={{ ...search(), category: category.slug }}
                class={pill}
                aria-current={
                  data().category === category.slug ? 'true' : undefined
                }
              >
                {category.name}
                <span class="font-mono text-[11.5px] text-fg-3">
                  {category.count}
                </span>
              </Link>
            )}
          </For>
        </Pills>
        <Pills label="Sort by">
          <Link
            to="/scripts"
            search={{ ...search(), sort: undefined }}
            class={pill}
            aria-current={data().sort === 'likes' ? 'true' : undefined}
          >
            Most liked
          </Link>
          <Link
            to="/scripts"
            search={{ ...search(), sort: 'newest' }}
            class={pill}
            aria-current={data().sort === 'newest' ? 'true' : undefined}
          >
            Newest
          </Link>
        </Pills>
      </div>

      <Show
        when={data().items.length > 0}
        fallback={
          <p class="mt-6 border border-line bg-surface-1 px-5 py-10 text-center text-fg-2">
            No scripts here yet.
          </p>
        }
      >
        <ul class="mt-6 divide-y divide-line border border-line bg-surface-1">
          <For each={data().items}>
            {(script) => <ScriptRow script={script} />}
          </For>
        </ul>
        <ShowMore
          shown={data().items.length}
          total={data().total}
          page={data().page}
          lastPage={FEED_MAX_PAGES}
        >
          <Link
            to="/scripts"
            search={{ ...search(), page: data().page + 1 }}
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
