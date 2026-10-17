import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { currentActor } from '../server/auth/actor'
import { findPeople } from '../server/services/people'

/** People with an account here whose name has the text in it, to credit. */
export const searchPeople = createServerFn({ method: 'GET' })
  .validator(z.object({ query: z.string().max(60) }))
  .handler(async ({ data }) => findPeople(await currentActor(), data.query))

export type FoundPerson = Extract<
  Awaited<ReturnType<typeof searchPeople>>,
  { ok: true }
>['people'][number]
