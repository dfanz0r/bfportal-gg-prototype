import { z } from 'zod'

import type { Game } from '../../shared/content'
import { gameInfo } from '../../shared/games'

// Looking an experience up on gametools.network, by its share code or its
// playground id. It needs no key.
//
// gametools is someone else's service: every call has a deadline, and the
// answer says which of three things happened. "Portal has no such
// experience" and "gametools did not answer" are different, and only the
// first says anything about the experience.

const BASE = 'https://api.gametools.network'
const DEADLINE_MS = 8000

export type LookedUp = {
  /** Null where gametools does not give a real one. */
  playgroundId: string | null
  /** Its share code, in lower case, where gametools states it. */
  code: string | null
  title: string
  description: string
  thumbnailUrl: string | null
  /** Whether Portal still offers it. */
  published: boolean
  rotation: {
    /** Portal's level id. Null where only the map's name is given. */
    levelId: string | null
    name: string | null
    mode: string
    rounds: number
    /** The size of each team, or one number for the whole lobby. */
    teams: number[]
  }[]
  /** Portal's ids for its tags. */
  tags: string[]
  xpMode: string | null
  /** Null where the game has no free version, or it is not stated. */
  requiresFullGame: boolean | null
}

export type Lookup =
  | { status: 'found'; experience: LookedUp }
  | { status: 'missing' }
  | { status: 'unavailable' }

const text = z.object({ value: z.string().nullish() }).nullish()

const bf6Schema = z.object({
  playElement: z.object({
    id: z.string().nullish(),
    name: z.string(),
    description: text,
    thumbnailUrl: text,
    // Without this there is no telling whether Portal still offers it, so a
    // reply that lacks it is not one to act on.
    publishStateType: z.string(),
    shortCode: text,
  }),
  playElementDesign: z
    .object({
      mapRotation: z
        .object({
          maps: z.array(
            z.object({
              levelName: z.string().nullish(),
              mapname: z.string().nullish(),
              mode: z.string().nullish(),
              rounds: z.number().nullish(),
              teamComposition: z
                .object({
                  teams: z.array(z.object({ capacity: z.number().nullish() })),
                })
                .nullish(),
            }),
          ),
        })
        .nullish(),
      tags: z.array(z.object({ tagId: z.string() })).nullish(),
      licenseRequirements: z.array(z.string()).nullish(),
    })
    .nullish(),
  progressionMode: text,
})

const bf2042Schema = z.object({
  originalPlayground: z.object({
    playgroundName: z.string(),
    playgroundDescription: z.string().nullish(),
    mapRotation: z
      .object({
        maps: z.array(
          z.object({
            mapname: z.string().nullish(),
            mode: z.string().nullish(),
            gameSize: z.number().nullish(),
            rounds: z.number().nullish(),
          }),
        ),
      })
      .nullish(),
  }),
  tag: z.array(z.object({ id: z.string() })).nullish(),
  progressionMode: text,
})

const readers: Record<Game, (body: unknown) => LookedUp> = {
  bf6(body) {
    const { playElement, playElementDesign, progressionMode } =
      bf6Schema.parse(body)
    const licenses = playElementDesign?.licenseRequirements
    return {
      playgroundId: playElement.id ?? null,
      code: playElement.shortCode?.value?.toLowerCase() ?? null,
      title: playElement.name,
      description: playElement.description?.value ?? '',
      thumbnailUrl: playElement.thumbnailUrl?.value ?? null,
      published:
        playElement.publishStateType === 'PUBLISH_STATE_TYPE_PUBLISHED',
      rotation: (playElementDesign?.mapRotation?.maps ?? []).map((map) => ({
        levelId: map.levelName ?? null,
        // gametools repeats the level id as the name when it has none.
        name: map.mapname && map.mapname !== map.levelName ? map.mapname : null,
        mode: map.mode ?? 'Custom',
        rounds: map.rounds ?? 1,
        teams: (map.teamComposition?.teams ?? []).map(
          (team) => team.capacity ?? 0,
        ),
      })),
      tags: (playElementDesign?.tags ?? []).map((tag) => tag.tagId),
      xpMode: progressionMode?.value ?? null,
      // An empty list says nothing either way.
      requiresFullGame:
        licenses && licenses.length > 0
          ? licenses.some((license) => license.startsWith('premium'))
          : null,
    }
  },
  bf2042(body) {
    const { originalPlayground, tag, progressionMode } =
      bf2042Schema.parse(body)
    return {
      // Looked up by code, gametools returns a row of zeros here.
      playgroundId: null,
      code: null,
      title: originalPlayground.playgroundName,
      description: originalPlayground.playgroundDescription ?? '',
      thumbnailUrl: null,
      // 2042 has no publish state: an answer at all means it is there.
      published: true,
      rotation: (originalPlayground.mapRotation?.maps ?? []).map((map) => ({
        levelId: null,
        name: map.mapname ?? null,
        mode: map.mode ?? 'Custom',
        rounds: map.rounds ?? 1,
        teams: map.gameSize ? [map.gameSize] : [],
      })),
      tags: (tag ?? []).map((item) => item.id),
      xpMode: progressionMode?.value ?? null,
      requiresFullGame: null,
    }
  },
}

const queries: Record<Game, (by: By) => string> = {
  bf6: (by) =>
    'code' in by
      ? `experiencecode=${encodeURIComponent(by.code)}`
      : `experienceid=${encodeURIComponent(by.playgroundId)}`,
  bf2042: (by) =>
    `${
      'code' in by
        ? `experiencecode=${encodeURIComponent(by.code)}`
        : `playgroundid=${encodeURIComponent(by.playgroundId)}`
    }&blockydata=false&lang=en-us&return_ownername=false`,
}

type By = { code: string } | { playgroundId: string }

const notFoundSchema = z.object({
  errors: z
    .array(z.string())
    .refine((errors) =>
      errors.some((message) => /not f(ou|i)nd/i.test(message)),
    ),
})

/**
 * Whether a 404 is gametools saying Portal has no such experience. Its own
 * 404 is JSON with a message saying so. Any other 404, from a proxy or a
 * changed address, says nothing about the experience.
 */
async function saysNotFound(response: Response) {
  try {
    return notFoundSchema.safeParse(await response.json()).success
  } catch {
    return false
  }
}

async function ask(game: Game, by: By): Promise<Lookup> {
  const url = `${BASE}/${gameInfo(game).gametools}/playground/?${queries[game](by)}`
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DEADLINE_MS),
      headers: { accept: 'application/json' },
    })
    if (response.status === 404) {
      return (await saysNotFound(response))
        ? { status: 'missing' }
        : { status: 'unavailable' }
    }
    if (!response.ok) return { status: 'unavailable' }
    return { status: 'found', experience: readers[game](await response.json()) }
  } catch (error) {
    // A timeout, a network failure, or an answer in a shape this does not
    // know. None of them says the experience is gone.
    console.error(`gametools lookup failed for ${game}:`, error)
    return { status: 'unavailable' }
  }
}

// Answers are kept for a minute. A creator fetching details and then
// submitting asks twice, and a moderator opening a review asks again; this
// makes those one request, and keeps a slow gametools from being waited on
// each time. "Unavailable" is not kept: the next ask should try again.
const KEEP_MS = 60 * 1000
const KEEP_AT_MOST = 500
const kept = new Map<string, { at: number; answer: Lookup }>()

/** Forgets every kept answer. For tests. */
export function forgetLookups() {
  kept.clear()
}

/** Looks an experience up. Never throws: it answers `unavailable` instead. */
export async function lookupExperience(game: Game, by: By): Promise<Lookup> {
  const key = `${game}:${'code' in by ? `code:${by.code}` : `id:${by.playgroundId}`}`
  const recent = kept.get(key)
  if (recent && Date.now() - recent.at < KEEP_MS) return recent.answer

  const answer = await ask(game, by)
  if (answer.status !== 'unavailable') {
    // The oldest goes first: a Map keeps the order things were added in.
    if (kept.size >= KEEP_AT_MOST)
      kept.delete(kept.keys().next().value as string)
    kept.set(key, { at: Date.now(), answer })
  }
  return answer
}
