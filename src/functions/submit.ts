import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { lookupExperience } from '../server/integrations/gametools'
import {
  getSubmitOptions,
  submitExperience,
} from '../server/services/submissions'
import { games } from '../shared/content'
import { formOr } from '../shared/form-input'
import { defaultGame, normalizeCode, parsePortalLink } from '../shared/games'
import { redirectTo } from './answer'

/**
 * What the submit page shows: what the form offers for the game, and what
 * Portal says about the code in the address, if there is one. `login` for a
 * visitor who is not signed in, who may not submit and may not use this to
 * look codes up.
 */
export const fetchSubmitPage = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      game: z.enum(games).optional(),
      code: z.string().max(20).optional(),
      link: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await currentActor())) return { state: 'login' as const }
    const linked = data.link ? parsePortalLink(data.link) : null
    // A pasted link says which game it is for.
    const game = linked?.game ?? data.game ?? defaultGame.id
    const code = data.code ? normalizeCode(game, data.code) : null
    const by = code
      ? { code }
      : linked
        ? { playgroundId: linked.playgroundId }
        : null

    const [options, looked] = await Promise.all([
      getSubmitOptions(game),
      by ? lookupExperience(game, by) : null,
    ])
    const found = looked?.status === 'found' ? looked.experience : null
    return {
      state: 'ok' as const,
      game,
      code,
      link: linked ? data.link : undefined,
      // The code or link that was typed and could not be read.
      unreadable: Boolean((data.code && !code) || (data.link && !linked)),
      lookup: looked?.status ?? null,
      options,
      // What Portal says, to start the form from. The creator can change any
      // of it; what is stored about the code is looked up again on submit.
      found: found && {
        title: found.title,
        description: found.description,
        thumbnailUrl: found.thumbnailUrl,
        published: found.published,
        maps: found.rotation.map((entry) => entry.name ?? entry.levelId ?? ''),
        players: Math.max(
          0,
          ...found.rotation.map((entry) =>
            entry.teams.reduce((sum, team) => sum + team, 0),
          ),
        ),
        tags: found.tags,
      },
    }
  })

/** Submits an experience for review. */
export const submitForReview = createServerFn({ method: 'POST' })
  .validator(formOr(z.record(z.string(), z.unknown())))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const result = await submitExperience(await currentActor(), data.input)
    if (data.viaForm) {
      if (result.ok) throw redirectTo(`/experiences/${result.slug}`)
      if (result.reason === 'signed-out') throw redirectTo('/login')
      // With no script there is nowhere to show errors beside the fields, so
      // the form is shown again with the first of them at the top.
      const back = new URLSearchParams()
      for (const name of ['game', 'code', 'link']) {
        const value = data.input[name]
        if (typeof value === 'string' && value) back.set(name, value)
      }
      back.set(
        'error',
        Object.values(result.errors ?? {})[0] ?? 'That could not be submitted.',
      )
      throw redirectTo(`/submit?${back}`)
    }
    return result
  })

export type SubmitPageData = Extract<
  Awaited<ReturnType<typeof fetchSubmitPage>>,
  { state: 'ok' }
>
