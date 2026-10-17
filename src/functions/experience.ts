import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { siteUrl } from '../server/env'
import { getExperience } from '../server/services/experience'
import {
  deleteOwnExperience,
  removeExperience,
} from '../server/services/experience-removal'
import { offerAsTemplate } from '../server/services/template-offers'
import { MAX_NOTE } from '../shared/decision'
import { formBoolean, formOr } from '../shared/form-input'
import { refuse } from '../shared/results'
import { formAnswer } from './answer'

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

/**
 * Offers an experience's files as a template, or stops offering them. Only
 * its owner may; offering something already published waits for a moderator.
 */
export const setTemplateOffer = createServerFn({ method: 'POST' })
  .validator(
    formOr(z.object({ slug: z.string().min(1).max(200), offer: formBoolean })),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = data.input
      ? await offerAsTemplate(
          await currentActor(),
          data.input.slug,
          data.input.offer,
        )
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

/** Deletes one of the visitor's own experiences. */
export const deleteExperience = createServerFn({ method: 'POST' })
  .validator(formOr(z.object({ slug: z.string().min(1).max(200) })))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = data.input
      ? await deleteOwnExperience(await currentActor(), data.input.slug)
      : refuse('invalid', data.errors)
    // Its page is gone; their list is where to go.
    if (data.viaForm)
      throw formAnswer(result, result.ok ? '/submissions' : data.back)
    return result
  })

/** Removes an experience for good, with a note to its owner. Moderators only. */
export const removeExperienceForGood = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        slug: z.string().min(1).max(200),
        note: z.string().max(MAX_NOTE).default(''),
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = data.input
      ? await removeExperience(
          await currentActor(),
          data.input.slug,
          data.input.note,
        )
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

export type Experience = NonNullable<
  Awaited<ReturnType<typeof fetchExperience>>
>
