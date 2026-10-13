import { createServerFn } from '@tanstack/solid-start'
import { z } from 'zod'

import { assertFromThisSite, currentActor } from '../server/auth/actor'
import { lookupExperience } from '../server/integrations/gametools'
import { allow } from '../server/rate-limit'
import {
  getSubmitOptions,
  keepDraft,
  readDraft,
  submitExperience,
} from '../server/services/submissions'
import { games } from '../shared/content'
import { formOr } from '../shared/form-input'
import { defaultGame, normalizeCode, parsePortalLink } from '../shared/games'
import { refuse } from '../shared/results'
import { redirectTo } from './answer'

/** How many codes one account may look up in a minute. */
const LOOKUPS_PER_MINUTE = 20

/**
 * What the submit page shows: what the form offers for the game, and what
 * Portal says about the code in the address, if there is one. `login` for a
 * visitor who is not signed in, who may not submit and may not use this to
 * look codes up.
 *
 * With `draft`, the form this visitor last had refused comes back as well, to
 * fill the page in again.
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
  .handler(async ({ data }) => {
    const actor = await currentActor()
    if (!actor) return { state: 'login' as const }
    const draft = data.draft ? await readDraft(actor) : null
    // A kept form says what it was for, where the address does not.
    const kept = (name: string) => {
      const value = draft?.fields[name]
      return typeof value === 'string' && value ? value : undefined
    }
    const typedLink = data.link ?? kept('link')
    const typedCode = data.code ?? kept('code')
    const linked = typedLink ? parsePortalLink(typedLink) : null
    // A pasted link says which game it is for.
    const game =
      linked?.game ??
      data.game ??
      z.enum(games).safeParse(kept('game')).data ??
      defaultGame.id
    const code = typedCode ? normalizeCode(game, typedCode) : null
    const by = code
      ? { code }
      : linked
        ? { playgroundId: linked.playgroundId }
        : null
    // Each lookup is a request to someone else's service.
    const limited =
      by !== null && !allow(`lookup:${actor.id}`, LOOKUPS_PER_MINUTE, 60 * 1000)

    const [options, looked] = await Promise.all([
      getSubmitOptions(game),
      by && !limited ? lookupExperience(game, by) : null,
    ])
    const found = looked?.status === 'found' ? looked.experience : null
    return {
      state: 'ok' as const,
      game,
      code,
      link: linked ? typedLink : undefined,
      // The code or link that was typed and could not be read.
      unreadable: Boolean((typedCode && !code) || (typedLink && !linked)),
      lookup: limited ? ('limited' as const) : (looked?.status ?? null),
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
      draft,
    }
  })

/** Submits an experience for review. */
export const submitForReview = createServerFn({ method: 'POST' })
  .validator(formOr(z.record(z.string(), z.unknown())))
  .handler(async ({ data }) => {
    assertFromThisSite()
    const actor = await currentActor()
    const result = data.input
      ? await submitExperience(actor, data.input)
      : refuse('invalid', data.errors)
    if (data.viaForm) {
      if (result.ok) throw redirectTo(`/experiences/${result.slug}`)
      if (!actor || result.reason === 'signed-out') throw redirectTo('/login')
      // With no script the page that was filled in is gone by now. What was
      // sent is kept, and the form is shown again with it and what was wrong.
      await keepDraft(
        actor,
        data.input ?? {},
        result.errors ?? { form: 'That could not be submitted.' },
      )
      throw redirectTo('/submit?draft=true')
    }
    return result
  })

export type SubmitPageData = Extract<
  Awaited<ReturnType<typeof fetchSubmitPage>>,
  { state: 'ok' }
>
