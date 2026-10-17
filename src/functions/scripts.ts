import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { currentActor } from '../server/auth/actor'
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

/**
 * A script's page, or null if there is none whoever is asking may see. Its
 * owner and the moderators see one that is not published yet.
 */
export const fetchScript = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }) =>
    getSnippet(data.slug, new Date(), await currentActor()),
  )

export type Scripts = Awaited<ReturnType<typeof fetchScripts>>
export type ScriptItem = Scripts['items'][number]
export type Script = NonNullable<Awaited<ReturnType<typeof fetchScript>>>
