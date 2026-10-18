import { Link } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { Snippets } from '../functions/snippets'
import { FEED_MAX_PAGES, type SnippetsSearch } from '../shared/feed-search'
import { SnippetRow } from './cards/snippet-row'
import { PageLayout } from './layout/page-layout'
import { Pills } from './ui/pills'
import { ShowMore } from './ui/show-more'
import { buttonGhost, pill } from './ui/ui'

const LEAD =
  'Rules, logic and interface snippets for the Battlefield 6 Portal editor. Copy one into your experience, or use it as a starting point.'

/** The head of the snippets list. */
export function snippetListHead() {
  return {
    meta: [
      { title: 'Snippets · bfportal.gg' },
      { name: 'description', content: LEAD },
    ],
  }
}

/** Every published snippet, by category, most liked or newest first. */
export function SnippetList(props: { data: Snippets }) {
  const data = () => props.data
  // What the address says now, without what is the default.
  const search = (): SnippetsSearch => ({
    category: data().category,
    sort: data().sort === 'newest' ? 'newest' : undefined,
  })

  return (
    <PageLayout title="Snippets" lead={LEAD}>
      <div class="flex flex-wrap items-center gap-x-8 gap-y-3">
        <Pills label="Category">
          <Link
            to="/snippets"
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
                to="/snippets"
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
            to="/snippets"
            search={{ ...search(), sort: undefined }}
            class={pill}
            aria-current={data().sort === 'likes' ? 'true' : undefined}
          >
            Most liked
          </Link>
          <Link
            to="/snippets"
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
            No snippets here yet.
          </p>
        }
      >
        <ul class="mt-6 divide-y divide-line border border-line bg-surface-1">
          <For each={data().items}>
            {(snippet) => <SnippetRow snippet={snippet} />}
          </For>
        </ul>
        <ShowMore
          shown={data().items.length}
          total={data().total}
          page={data().page}
          lastPage={FEED_MAX_PAGES}
        >
          <Link
            to="/snippets"
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
