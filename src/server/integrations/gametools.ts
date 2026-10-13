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
    publishStateType: z.string().nullish(),
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
      requiresFullGame: licenses
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
      ? `experiencecode=${by.code}`
      : `experienceid=${by.playgroundId}`,
  bf2042: (by) =>
    `${'code' in by ? `experiencecode=${by.code}` : `playgroundid=${by.playgroundId}`}&blockydata=false&lang=en-us&return_ownername=false`,
}

type By = { code: string } | { playgroundId: string }

/** Looks an experience up. Never throws: it answers `unavailable` instead. */
export async function lookupExperience(game: Game, by: By): Promise<Lookup> {
  const url = `${BASE}/${gameInfo(game).gametools}/playground/?${queries[game](by)}`
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(DEADLINE_MS),
      headers: { accept: 'application/json' },
    })
    if (response.status === 404) return { status: 'missing' }
    if (!response.ok) return { status: 'unavailable' }
    return { status: 'found', experience: readers[game](await response.json()) }
  } catch (error) {
    // A timeout, a network failure, or an answer in a shape this does not
    // know. None of them says the experience is gone.
    console.error(`gametools lookup failed for ${game}:`, error)
    return { status: 'unavailable' }
  }
}
