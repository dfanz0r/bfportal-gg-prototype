import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { currentActor } from '../server/auth/actor'
import { siteUrl } from '../server/env'
import { getExperience } from '../server/services/experience'

/** An experience's page, or null if there is no such public experience. */
export const fetchExperience = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    const experience = await getExperience(
      data.slug,
      new Date(),
      await currentActor(),
    )
    return experience && { ...experience, siteUrl }
  })

export type Experience = NonNullable<
  Awaited<ReturnType<typeof fetchExperience>>
>
