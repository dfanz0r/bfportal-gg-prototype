import { and, asc, desc, eq, isNull, or } from 'drizzle-orm'

import { type Game, games } from '../../shared/content'
import { defaultGame, normalizeCode, parsePortalLink } from '../../shared/games'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { categories, sdkVersions, tagGroups, tags } from '../db/schema'
import { lookupExperience } from '../integrations/gametools'
import { allow } from '../rate-limit'
import { readDraft } from './drafts'
import { peopleByDiscordId } from './people'
import { groupBy } from './shared'

// What the page for sharing an experience starts from: what the form offers
// for the game, what Portal says about a code, and a refused form to show
// again.

/** How many codes one account may look up in a minute. */
const LOOKUPS_PER_MINUTE = 20

/** What the page's address can ask for. */
export type SubmitSearch = {
  game?: Game
  code?: string
  link?: string
  /** Show this visitor's last refused form again. */
  draft?: boolean
}

/**
 * The submit page for whoever is acting. `login` for a visitor who is not
 * signed in, who may not submit and may not use this to look codes up.
 */
export async function getSubmitPage(
  actor: Actor | null,
  search: SubmitSearch,
  options: { lookup?: typeof lookupExperience } = {},
) {
  if (!actor) return { state: 'login' as const }
  const draft = search.draft ? await readDraft(actor, 'experience') : null
  // A kept form says what it was for, where the address does not.
  const kept = (name: string) => {
    const value = draft?.fields[name]
    return typeof value === 'string' && value ? value : undefined
  }
  const typedLink = search.link ?? kept('link')
  const typedCode = search.code ?? kept('code')
  const linked = typedLink ? parsePortalLink(typedLink) : null
  // A pasted link says which game it is for.
  const game =
    linked?.game ??
    search.game ??
    games.find((item) => item === kept('game')) ??
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

  const [offered, looked, credited] = await Promise.all([
    getSubmitOptions(game),
    by && !limited ? (options.lookup ?? lookupExperience)(game, by) : null,
    // A kept form holds the accounts it credited by id. The form shows
    // their names and pictures.
    peopleByDiscordId(
      [draft?.fields.creditAccounts ?? []].flat().map(String).slice(0, 20),
    ),
  ])
  const found = looked?.status === 'found' ? looked.experience : null
  return {
    state: 'ok' as const,
    game,
    // What was typed, as typed, for the fields to start from.
    code: typedCode ?? '',
    link: typedLink ?? '',
    // The code or link that was typed and could not be read.
    unreadable: Boolean((typedCode && !code) || (typedLink && !linked)),
    lookup: limited ? ('limited' as const) : (looked?.status ?? null),
    options: offered,
    // What Portal says, to start the form from. The creator can change any
    // of it; what is stored about the code is looked up again on submit.
    found: found && {
      code: found.code,
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
      // The players on each team of the first map, to start the teams from.
      teams: found.rotation[0]?.teams ?? [],
      tags: found.tags,
    },
    draft,
    credited,
  }
}

/**
 * What the submit form offers for a game: its categories and the tags a
 * creator may choose. With them, the game's current SDK release, which the
 * form states and does not ask for.
 */
export async function getSubmitOptions(game: Game) {
  const [categoryRows, tagRows, [currentSdk]] = await Promise.all([
    db
      .select({
        name: categories.name,
        slug: categories.slug,
        marksTemplate: categories.marksTemplate,
      })
      .from(categories)
      .where(
        and(
          eq(categories.kind, 'experience_main'),
          eq(categories.visible, true),
          eq(categories.selectableOnForm, true),
          or(isNull(categories.game), eq(categories.game, game)),
        ),
      )
      .orderBy(asc(categories.sortOrder)),
    db
      .select({
        group: tagGroups.name,
        description: tagGroups.description,
        pick: tagGroups.pick,
        name: tags.name,
        slug: tags.slug,
        portalId: tags.portalId,
      })
      .from(tags)
      .innerJoin(tagGroups, eq(tagGroups.id, tags.groupId))
      .where(
        and(
          eq(tags.game, game),
          eq(tags.visible, true),
          eq(tagGroups.creatorSelectable, true),
        ),
      )
      .orderBy(asc(tagGroups.sortOrder), asc(tags.sortOrder), asc(tags.name)),
    db
      .select({ version: sdkVersions.version, season: sdkVersions.season })
      .from(sdkVersions)
      .where(eq(sdkVersions.game, game))
      .orderBy(desc(sdkVersions.sortOrder))
      .limit(1),
  ])
  return {
    categories: categoryRows,
    tagGroups: [...groupBy(tagRows, (row) => row.group).values()].map(
      (group) => ({
        name: group[0].group,
        description: group[0].description,
        pick: group[0].pick,
        tags: group.map((tag) => ({
          name: tag.name,
          slug: tag.slug,
          portalId: tag.portalId,
        })),
      }),
    ),
    currentSdk: currentSdk ?? null,
  }
}
