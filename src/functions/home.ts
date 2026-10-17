import { createServerFn } from '@tanstack/solid-start'

import { currentActor } from '../server/auth/actor'
import { getHome } from '../server/services/home'

/** What the home page shows. */
export const fetchHome = createServerFn({ method: 'GET' }).handler(async () =>
  getHome(new Date(), (await currentActor())?.id ?? null),
)

export type Home = Awaited<ReturnType<typeof fetchHome>>
