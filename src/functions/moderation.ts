import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import {
  decideSnippet,
  decideSubmission,
  getSubmissionReview,
  listQueue,
} from '../server/services/moderation'
import { MAX_NOTE } from '../shared/decision'
import { formBoolean, formOr } from '../shared/form-input'
import { type Refusal, refuse } from '../shared/results'
import { redirectTo } from './answer'

// The moderators' screens. The services refuse anyone who is not a moderator
// or an admin; nothing here decides that.

/** Everything waiting for a moderator. */
export const fetchQueue = createServerFn({ method: 'GET' }).handler(async () =>
  listQueue(await currentActor()),
)

/** One waiting submission, with what to check before deciding. */
export const fetchSubmissionReview = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) =>
    getSubmissionReview(await currentActor(), data.id),
  )

/** What a decision sends, from the page's script or a form. */
const decisionSchema = z.object({
  id: z.coerce.number().int().positive(),
  approve: formBoolean,
  note: z.string().max(MAX_NOTE).optional(),
})

/**
 * Where a decision posted with no script goes. Decided: the queue. Refused
 * for its note: back to the page it was made on, `back`, with what was wrong
 * and the note as written, for the page to say so and fill it in again.
 */
function decisionAnswer(
  result: { ok: true } | Refusal,
  back: string,
  note: string | undefined,
) {
  if (result.ok) return redirectTo('/admin')
  if (result.reason === 'signed-out') return redirectTo('/login')
  if (result.reason !== 'invalid') return redirectTo('/admin')
  const search = new URLSearchParams({ problem: 'note' })
  if (note) search.set('note', note)
  return redirectTo(`${back.split('?')[0]}?${search}`)
}

/** Approves a waiting submission, or sends it back with changes requested. */
export const decide = createServerFn({ method: 'POST' })
  .validator(formOr(decisionSchema))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const result = input
      ? await decideSubmission(await currentActor(), input.id, input)
      : refuse('invalid', data.errors)
    if (data.viaForm) throw decisionAnswer(result, data.back, input?.note)
    return result
  })

/** Approves a waiting snippet, or sends it back with changes requested. */
export const decideOnSnippet = createServerFn({ method: 'POST' })
  .validator(formOr(decisionSchema))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const result = input
      ? await decideSnippet(await currentActor(), input.id, input)
      : refuse('invalid', data.errors)
    if (data.viaForm) throw decisionAnswer(result, data.back, input?.note)
    return result
  })

export type Queue = Extract<
  Awaited<ReturnType<typeof fetchQueue>>,
  { ok: true }
>
export type SubmissionReview = Extract<
  Awaited<ReturnType<typeof fetchSubmissionReview>>,
  { ok: true }
>
