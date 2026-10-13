import { z } from 'zod'

import { games } from './content'

// The address parameters of the listing pages other than the Library. As
// there, something that does not parse is dropped, never an error.

export const FEED_PAGE_SIZE = 12
/** "Show more" grows the page. This is where it stops. */
export const FEED_MAX_PAGES = 20

const page = z.coerce
  .number()
  .int()
  .min(1)
  .max(FEED_MAX_PAGES)
  .optional()
  .catch(undefined)

export const updatesSearchSchema = z.object({
  kind: z.enum(['experience', 'script']).optional().catch(undefined),
  game: z.enum(games).optional().catch(undefined),
  page,
})
export type UpdatesSearch = z.infer<typeof updatesSearchSchema>

export const eventsSearchSchema = z.object({
  when: z.enum(['past']).optional().catch(undefined),
})

export const scriptsSearchSchema = z.object({
  category: z
    .preprocess((value) => String(value ?? ''), z.string().max(80))
    .optional()
    .catch(undefined),
  sort: z.enum(['newest']).optional().catch(undefined),
  page,
})
export type ScriptsSearch = z.infer<typeof scriptsSearchSchema>

/** The lists on a profile. The first is what its bare address shows. */
export const profileTabs = ['experiences', 'scripts', 'liked'] as const
export type ProfileTab = (typeof profileTabs)[number]

export const profileSearchSchema = z.object({
  tab: z.enum(profileTabs).optional().catch(undefined),
  page,
})
