import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { setLike, setSnippetLike } from '../server/services/likes'
import { formBoolean, formOr } from '../shared/form-input'
import { refuse } from '../shared/results'
import { formAnswer } from './answer'

// The shape every write follows: check the request came from the site, find
// out who is acting, hand both the question and the actor to a service, and
// answer a plain form with a redirect. The rules are in the service.

const likeSchema = z.object({
  slug: z.string().min(1).max(200),
  liked: formBoolean,
})

/** Likes or unlikes an experience for the signed-in visitor. */
export const likeExperience = createServerFn({ method: 'POST' })
  .validator(formOr(likeSchema))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = data.input
      ? await setLike(await currentActor(), data.input.slug, data.input.liked)
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })

/** Likes or unlikes a snippet for the signed-in visitor. */
export const likeSnippet = createServerFn({ method: 'POST' })
  .validator(formOr(likeSchema))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = data.input
      ? await setSnippetLike(
          await currentActor(),
          data.input.slug,
          data.input.liked,
        )
      : refuse('invalid', data.errors)
    if (data.viaForm) throw formAnswer(result, data.back)
    return result
  })
