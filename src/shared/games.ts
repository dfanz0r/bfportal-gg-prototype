import type { ExperienceType, Game } from './content'

/**
 * What the site knows about each game. Pages, forms and jobs read from here
 * and never test for a game by name, so a new title is an entry in this file
 * and whatever is truly new about it. Its categories, tags and maps are rows
 * an admin enters; see "Games" in PLAN.md.
 */
export type GameInfo = {
  id: Game
  name: string
  /** Where its Library tab lives. The first game has the bare address. */
  libraryPath: '/library' | `/library/${string}`
  /** A share code, as stored: lower case, no spaces. */
  codePattern: RegExp
  /** The path segment gametools.network uses for it. */
  gametools: string
  /**
   * The experience's page for players, on EA's public browser of published
   * experiences. Null for a game that has none.
   */
  publicPage: ((playgroundId: string) => string) | null
  /**
   * The experience opened in the Portal editor, which works when its creator
   * allows copying. The editor has a page per step, all under `prefix`, and
   * every one of them carries the playground id in `param`.
   */
  editor: { prefix: string; param: string }
  /** What an experience can be built with, if the game says. */
  builtWith: readonly ExperienceType[]
  /** Whether there is a free version, so "needs the full game" means something. */
  hasFreeVersion: boolean
  /** What can be submitted for it, said under its name on the submit form. */
  submitNote: string
  library: {
    title: string
    lead: string
    sort: 'trending' | 'likes'
    /**
     * What the head of its Library leads with. A game people are still
     * building for leads with what is new; one that is an archive leads with
     * how much of it still loads.
     */
    leadsWith: 'new' | 'health'
  }
}

const PORTAL = 'https://portal.battlefield.com'

/** In the order of the Library's tabs. */
export const gameList: readonly GameInfo[] = [
  {
    id: 'bf6',
    name: 'Battlefield 6',
    libraryPath: '/library',
    codePattern: /^[a-z0-9]{4,5}$/,
    gametools: 'bf6',
    publicPage: (id) =>
      `https://www.ea.com/games/battlefield/battlefield-6/portal/buy/creation/${id}`,
    editor: { prefix: '/bf6/experience', param: 'id' },
    builtWith: ['script', 'blocks', 'spatial', 'verified'],
    hasFreeVersion: true,
    submitNote: 'Experiences and templates.',
    library: {
      title: 'Experience library',
      lead: 'Every Battlefield 6 experience shared with the community. Filter by mode, size and tags, or paste a code to check it before you load in.',
      sort: 'trending',
      leadsWith: 'new',
    },
  },
  {
    id: 'bf2042',
    name: 'Battlefield 2042',
    libraryPath: '/library/bf2042',
    codePattern: /^[a-z0-9]{6}$/,
    gametools: 'bf2042',
    publicPage: null,
    // 2042's editor pages sit at the root of the site, beside nothing else.
    editor: { prefix: '/experience', param: 'playgroundId' },
    builtWith: [],
    hasFreeVersion: false,
    submitNote:
      'Experiences only. Its Portal has no TypeScript and no export to upload.',
    library: {
      title: 'Battlefield 2042 library',
      lead: "Every experience the community shared for 2042's Portal, from Bad Company Rush to wingsuit races. Still here, still searchable, and checked every night against the game.",
      sort: 'likes',
      leadsWith: 'health',
    },
  },
]

export const defaultGame = gameList[0]

export function gameInfo(id: Game) {
  // Every `Game` has an entry: the test for this file checks it.
  return gameList.find((game) => game.id === id) as GameInfo
}

/** The game a Library address names, or undefined if it names none. */
export function gameFromSlug(slug: string) {
  return gameList.find((game) => game.id === slug)
}

/** A share code as stored, or null if it is not one for this game. */
export function normalizeCode(game: Game, input: string) {
  const code = input.trim().toLowerCase()
  return gameInfo(game).codePattern.test(code) ? code : null
}

const PLAYGROUND_ID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

export function editorUrl(game: Game, playgroundId: string) {
  const { prefix, param } = gameInfo(game).editor
  return `${PORTAL}${prefix}?${param}=${playgroundId}`
}

export function publicPageUrl(game: Game, playgroundId: string) {
  return gameInfo(game).publicPage?.(playgroundId) ?? null
}

/**
 * Reads the game and playground id out of a link a creator pasted: either of
 * an experience's two pages, in any of the editor's forms. Null if it is not
 * one of them.
 */
export function parsePortalLink(
  link: string,
): { game: Game; playgroundId: string } | null {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  const path = url.pathname.replace(/\/+$/, '')

  for (const game of gameList) {
    let found: string | null | undefined
    if (url.origin === PORTAL) {
      const { prefix, param } = game.editor
      // Longer prefixes are other games' editors: "/bf6/experience" is not
      // 2042's "/experience".
      if (path === prefix || path.startsWith(`${prefix}/`)) {
        found = url.searchParams.get(param)
      }
    } else if (game.publicPage) {
      const page = new URL(game.publicPage('ID'))
      const base = page.pathname.slice(0, -'ID'.length)
      // EA's site puts a locale in front of the path for some visitors.
      const at = path.indexOf(base)
      if (url.origin === page.origin && at >= 0) {
        found = path.slice(at + base.length)
      }
    }
    const playgroundId = found?.toLowerCase()
    if (playgroundId && PLAYGROUND_ID.test(playgroundId)) {
      return { game: game.id, playgroundId }
    }
  }
  return null
}
