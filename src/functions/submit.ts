import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { keepDraft } from '../server/services/drafts'
import {
  EXPERIENCE_FIELDS,
  submitExperience,
} from '../server/services/experience-submissions'
import { getSubmitPage } from '../server/services/submit-page'
import { games } from '../shared/content'
import { formOr } from '../shared/form-input'
import { defaultGame } from '../shared/games'
import { refuse } from '../shared/results'
import { redirectTo } from './answer'

/**
 * What the submit page shows: what the form offers for the game, and what
 * Portal says about the code in the address, if there is one. With `draft`,
 * the form this visitor last had refused comes back as well.
 */
export const fetchSubmitPage = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      game: z.enum(games).optional(),
      code: z.string().max(20).optional(),
      link: z.string().max(500).optional(),
      draft: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => getSubmitPage(await currentActor(), data))

/** Submits an experience for review. */
export const submitForReview = createServerFn({ method: 'POST' })
  .validator(formOr(z.record(z.string(), z.unknown())))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const actor = await currentActor()
    const result = data.input
      ? await submitExperience(actor, data.input)
      : refuse('invalid', data.errors)
    if (!data.viaForm) return result
    if (result.ok) throw redirectTo(`/experiences/${result.slug}`)
    if (!actor || result.reason === 'signed-out') throw redirectTo('/login')
    // With no script the page that was filled in is gone by now. What was
    // sent is kept, and the form is shown again with it and what was wrong.
    await keepDraft(
      actor,
      'experience',
      data.input ?? {},
      result.errors ?? { form: 'That could not be submitted.' },
      EXPERIENCE_FIELDS,
    )
    throw redirectTo('/submit?draft=true')
  })

/**
 * "Fetch details" on the submit form, posted with no script: the code and
 * link are fields of the form that is submitted, so the button posts that
 * form here, and this goes to the page for the code. The page's script goes
 * there itself.
 */
export const startFromCode = createServerFn({ method: 'POST' })
  .validator(
    formOr(
      z.object({
        game: z.enum(games).catch(defaultGame.id),
        code: z.string().max(20).catch(''),
        link: z.string().max(500).catch(''),
      }),
    ),
  )
  .handler(async ({ data }) => {
    const search = new URLSearchParams()
    const { game, code, link } = data.input ?? {}
    if (game && game !== defaultGame.id) search.set('game', game)
    if (code?.trim()) search.set('code', code.trim())
    if (link?.trim()) search.set('link', link.trim())
    const query = search.toString()
    throw redirectTo(query ? `/submit?${query}` : '/submit')
  })

export type SubmitPageData = Extract<
  Awaited<ReturnType<typeof fetchSubmitPage>>,
  { state: 'ok' }
>
