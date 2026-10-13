import { createServerFn } from '@tanstack/solid-start'
import { getRequestHeaders } from '@tanstack/solid-start/server'
import { z } from 'zod'

import { auth } from '../server/auth'
import { getProfile, profilesNeedLogin } from '../server/services/profiles'
import { FEED_MAX_PAGES, profileTabs } from '../shared/feed-search'

/**
 * A person's profile. `login` when the site keeps profiles for signed-in
 * visitors and this one is not; null when there is no such person.
 */
export const fetchProfile = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      discordId: z.string().regex(/^\d{1,25}$/),
      tab: z.enum(profileTabs).optional(),
      page: z.number().int().min(1).max(FEED_MAX_PAGES).optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (await profilesNeedLogin()) {
      const session = await auth.api.getSession({
        headers: getRequestHeaders(),
      })
      if (!session) return { state: 'login' as const }
    }
    const profile = await getProfile(
      data.discordId,
      data.tab ?? 'experiences',
      data.page ?? 1,
    )
    return profile && { state: 'ok' as const, profile }
  })

export type Profile = NonNullable<Awaited<ReturnType<typeof getProfile>>>
