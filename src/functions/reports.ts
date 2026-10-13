import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { reportExperience } from '../server/services/reports'
import { reportTypes } from '../shared/content'
import { formOr } from '../shared/form-input'
import { refuse } from '../shared/results'
import { formAnswer } from './answer'

/** Reports a problem with an experience, for a moderator to look at. */
export const reportProblem = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({ slug: z.string().min(1).max(200), type: z.enum(reportTypes) }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = data.input
      ? await reportExperience(
          await currentActor(),
          data.input.slug,
          data.input.type,
        )
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })
