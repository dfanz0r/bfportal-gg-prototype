import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { getSnippet, listSnippets } from '../server/services/snippets'
import { FEED_PAGE_SIZE, scriptsSearchSchema } from '../shared/feed-search'

/** The scripts list, by category. */
export const fetchScripts = createServerFn({ method: 'GET' })
  .validator(scriptsSearchSchema)
  .handler(async ({ data }) => ({
    ...(await listSnippets({
      category: data.category,
      sort: data.sort,
      // "Show more" grows the page: page two holds the first two pages.
      limit: (data.page ?? 1) * FEED_PAGE_SIZE,
    })),
    page: data.page ?? 1,
  }))

/** A script's page, or null if there is no such public script. */
export const fetchScript = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(({ data }) => getSnippet(data.slug))

export type Scripts = Awaited<ReturnType<typeof fetchScripts>>
export type ScriptItem = Scripts['items'][number]
export type Script = NonNullable<Awaited<ReturnType<typeof fetchScript>>>
