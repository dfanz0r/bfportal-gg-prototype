import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { setLike } from '../server/services/likes'
import { formBoolean, formOr } from '../shared/form-input'
import { formAnswer } from './answer'

// The shape every write follows: check the request came from the site, find
// out who is acting, hand both the question and the actor to a service, and
// answer a plain form with a redirect. The rules are in the service.

/** Likes or unlikes an experience for the signed-in visitor. */
export const likeExperience = createServerFn({ method: 'POST' })
  .validator(
    formOr(z.object({ slug: z.string().min(1).max(200), liked: formBoolean })),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = await setLike(
      await currentActor(),
      data.input.slug,
      data.input.liked,
    )
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })
