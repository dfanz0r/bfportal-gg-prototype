import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import {
  decideSubmission,
  getSubmissionReview,
  listQueue,
} from '../server/services/moderation'
import { formBoolean, formOr } from '../shared/form-input'
import { refuse } from '../shared/results'
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

/** Approves a waiting submission, or turns it down with a note. */
export const decide = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        id: z.coerce.number().int().positive(),
        approve: formBoolean,
        note: z.string().max(1000).optional(),
      }),
    ),
  )
  .handler(async ({ data }) => {
    assertFromThisSite()
    const { input } = data
    const result = input
      ? await decideSubmission(await currentActor(), input.id, {
          approve: input.approve,
          note: input.note,
        })
      : refuse('invalid', data.errors)
    if (data.viaForm) {
      if (result.ok) throw redirectTo('/admin')
      if (result.reason === 'signed-out') throw redirectTo('/login')
      // Back to the submission, which says what was missing. The address
      // names the problem; the page has the words for it.
      throw redirectTo(
        input && result.reason === 'invalid'
          ? `/admin/review/${input.id}?problem=note`
          : '/admin',
      )
    }
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
