import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import {
  dismissReports,
  listReports,
  setHealthFlags,
} from '../server/services/admin-reports'
import { reportsSearchSchema } from '../shared/admin-search'
import { formCheckbox, formOr } from '../shared/form-input'
import { refuse } from '../shared/results'
import { formAnswer } from './answer'

// What players have reported, for the moderators. The services refuse anyone
// who is not staff.

/** The reported experiences, as the screen's address filters them. */
export const fetchReports = createServerFn({ method: 'GET' })
  .validator(reportsSearchSchema)
  .handler(async ({ data }) =>
    listReports(await currentActor(), {
      state: data.state ?? 'open',
      game: data.game,
      kind: data.kind,
      sort: data.sort ?? 'most',
    }),
  )

const slugSchema = z.object({ slug: z.string().min(1).max(200) })

/** Dismisses an experience's open reports. */
export const dismiss = createServerFn({ method: 'POST' })
  .validator(formOr(slugSchema))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = data.input
      ? await dismissReports(await currentActor(), data.input.slug)
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

/** Sets an experience's health flags, which deals with its reports. */
export const setFlags = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      slugSchema.extend({
        bugged: formCheckbox,
        broken: formCheckbox,
        xpFarm: formCheckbox,
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const result = input
      ? await setHealthFlags(await currentActor(), input.slug, input)
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

export type Reports = Extract<
  Awaited<ReturnType<typeof fetchReports>>,
  { ok: true }
>
