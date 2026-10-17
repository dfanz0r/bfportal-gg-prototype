import { and, count, countDistinct, desc, eq, gt, lte } from 'drizzle-orm'

import { defaultGame, gameList } from '../../shared/games'
import { db } from '../db'
import { banners, experiences } from '../db/schema'
import { listEvents } from './events'
import {
  available,
  likes,
  likesSince,
  listCards,
  visible,
} from './experience-cards'
import { listPlaytests } from './playtests'
import { listSnippets } from './snippets'
import { listUpdates } from './updates'

// What the home page shows: a little of everything that is new or popular.

const DAY = 24 * 60 * 60 * 1000

export async function getHome(
  now = new Date(),
  /** Who is looking, for the experiences they like. */
  viewer: string | null = null,
) {
  const [
    [banner],
    [experienceStats],
    perGame,
    trending,
    updates,
    playtests,
    scripts,
    events,
  ] = await Promise.all([
    // The notice showing now, if there is one.
    db
      .select({
        label: banners.label,
        message: banners.message,
        linkLabel: banners.linkLabel,
        linkUrl: banners.linkUrl,
      })
      .from(banners)
      .where(and(lte(banners.startsAt, now), gt(banners.endsAt, now)))
      .orderBy(desc(banners.startsAt))
      .limit(1),
    db
      .select({
        experiences: count(),
        creators: countDistinct(experiences.ownerId),
      })
      .from(experiences)
      .where(and(visible, available)),
    db
      .select({ game: experiences.game, value: count() })
      .from(experiences)
      .where(and(visible, available))
      .groupBy(experiences.game),
    listCards({
      where: and(eq(experiences.game, defaultGame.id), visible, available),
      orderBy: [
        desc(likesSince(new Date(now.getTime() - 7 * DAY))),
        desc(likes),
        desc(experiences.id),
      ],
      limit: 8,
      viewer,
    }),
    listUpdates({ limit: 3 }),
    listPlaytests({ state: 'open', limit: 3 }, now),
    listSnippets({ limit: 4 }),
    listEvents({ when: 'upcoming', limit: 3 }, now),
  ])

  return {
    banner: banner ?? null,
    stats: {
      experiences: experienceStats.experiences,
      scripts: scripts.all,
      creators: experienceStats.creators,
    },
    games: gameList.map((game) => ({
      id: game.id,
      name: game.name,
      count: perGame.find((row) => row.game === game.id)?.value ?? 0,
    })),
    trending,
    updates: updates.items,
    playtests: playtests.items,
    scripts: scripts.items,
    events: events.items,
    now,
  }
}

export type HomeData = Awaited<ReturnType<typeof getHome>>
