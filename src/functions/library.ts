import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { siteUrl } from '../server/env'
import { getLibrary } from '../server/services/library'
import { games } from '../shared/content'
import { librarySearchSchema } from '../shared/library-search'

/** One game's Library: its experiences, filtered, and what the filters offer. */
export const fetchLibrary = createServerFn({ method: 'GET' })
  .validator(z.object({ game: z.enum(games), search: librarySearchSchema }))
  .handler(async ({ data }) => ({
    ...(await getLibrary(data.game, data.search)),
    // For the page's canonical address, which has to be a whole one.
    siteUrl,
  }))

export type Library = Awaited<ReturnType<typeof fetchLibrary>>
