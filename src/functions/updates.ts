import { createServerFn } from '@tanstack/solid-start'

import { listUpdates } from '../server/services/updates'
import { FEED_PAGE_SIZE, updatesSearchSchema } from '../shared/feed-search'

/** The updates feed: posts on experiences and scripts, newest first. */
export const fetchUpdates = createServerFn({ method: 'GET' })
  .validator(updatesSearchSchema)
  .handler(async ({ data }) => ({
    ...(await listUpdates({
      kind: data.kind,
      game: data.game,
      // "Show more" grows the page: page two holds the first two pages.
      limit: (data.page ?? 1) * FEED_PAGE_SIZE,
    })),
    search: data,
    now: new Date(),
  }))

export type Updates = Awaited<ReturnType<typeof fetchUpdates>>
export type UpdateItem = Updates['items'][number]
