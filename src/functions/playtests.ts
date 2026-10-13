import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { getPlaytest, listPlaytests } from '../server/services/playtests'

/** Open playtests, and the ones that closed most recently. */
export const fetchPlaytests = createServerFn({ method: 'GET' }).handler(
  async () => {
    const now = new Date()
    const [open, closed] = await Promise.all([
      listPlaytests({ state: 'open', limit: 50 }, now),
      listPlaytests({ state: 'closed', limit: 6 }, now),
    ])
    return { open, closed }
  },
)

/** One playtest's page, or null unless it was approved and has opened. */
export const fetchPlaytest = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(({ data }) => getPlaytest(data.id))

export type Playtests = Awaited<ReturnType<typeof fetchPlaytests>>
export type PlaytestItem = Playtests['open']['items'][number]
export type Playtest = NonNullable<Awaited<ReturnType<typeof fetchPlaytest>>>
