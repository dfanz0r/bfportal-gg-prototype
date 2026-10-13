import { createServerFn } from '@tanstack/solid-start'

import { getHome } from '../server/services/home'

/** What the home page shows. */
export const fetchHome = createServerFn({ method: 'GET' }).handler(() =>
  getHome(),
)

export type Home = Awaited<ReturnType<typeof fetchHome>>
