import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import {
  listAdminExperiences,
  listAdminSnippets,
  setListed,
  setSpotlight,
} from '../server/services/admin-content'
import {
  adminExperiencesSearchSchema,
  adminSnippetsSearchSchema,
} from '../shared/admin-search'
import { formBoolean, formOr } from '../shared/form-input'
import { refuse } from '../shared/results'
import { formAnswer } from './answer'

// Every experience and snippet, for the moderators; featured and trending,
// for the admins. The services decide who may do which.

/** Experiences, as the screen's address filters them. */
export const fetchAdminExperiences = createServerFn({ method: 'GET' })
  .validator(adminExperiencesSearchSchema)
  .handler(async ({ data }) => listAdminExperiences(await currentActor(), data))

/** Snippets, as the screen's address filters them. */
export const fetchAdminSnippets = createServerFn({ method: 'GET' })
  .validator(adminSnippetsSearchSchema)
  .handler(async ({ data }) => listAdminSnippets(await currentActor(), data))

const targetSchema = z.object({
  kind: z.enum(['experience', 'snippet']),
  slug: z.string().min(1).max(200),
})

/** Features an experience or a snippet, or marks it trending, or stops. */
export const spotlight = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      targetSchema.extend({
        featured: formBoolean.optional(),
        trending: formBoolean.optional(),
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const result = input
      ? await setSpotlight(await currentActor(), input.kind, input.slug, {
          featured: input.featured,
          trending: input.trending,
        })
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

/** Delists something live, or lists it again. */
export const list = createServerFn({ method: 'POST' })
  .validator(formOr(targetSchema.extend({ listed: formBoolean })))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const result = input
      ? await setListed(
          await currentActor(),
          input.kind,
          input.slug,
          input.listed,
        )
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

export type AdminExperiences = Extract<
  Awaited<ReturnType<typeof fetchAdminExperiences>>,
  { ok: true }
>
export type AdminSnippets = Extract<
  Awaited<ReturnType<typeof fetchAdminSnippets>>,
  { ok: true }
>
