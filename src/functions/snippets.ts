import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { currentActor } from '../server/auth/actor'
import { getSnippet, listSnippets } from '../server/services/snippets'
import { FEED_PAGE_SIZE, snippetsSearchSchema } from '../shared/feed-search'

/** The snippets list, by category. */
export const fetchSnippets = createServerFn({ method: 'GET' })
  .validator(snippetsSearchSchema)
  .handler(async ({ data }) => ({
    ...(await listSnippets({
      category: data.category,
      sort: data.sort,
      // "Show more" grows the page: page two holds the first two pages.
      limit: (data.page ?? 1) * FEED_PAGE_SIZE,
      viewer: (await currentActor())?.id ?? null,
    })),
    page: data.page ?? 1,
  }))

/**
 * A snippet's page, or null if there is none whoever is asking may see. Its
 * owner and the moderators see one that is not published yet.
 */
export const fetchSnippet = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }) =>
    getSnippet(data.slug, new Date(), await currentActor()),
  )

export type Snippets = Awaited<ReturnType<typeof fetchSnippets>>
export type SnippetItem = Snippets['items'][number]
export type Snippet = NonNullable<Awaited<ReturnType<typeof fetchSnippet>>>
