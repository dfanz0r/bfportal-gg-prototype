import { and, count, desc, eq, isNotNull, isNull, or } from 'drizzle-orm'

import type { Game } from '../../shared/content'
import { db } from '../db'
import { experiences, snippets, updates, user } from '../db/schema'
import { visible } from './experience-cards'
import { excerpt, personColumns, publicPerson } from './shared'
import { snippetVisible } from './snippets'

// Update posts across the site: release notes, status reports and calls for
// testers, on experiences and scripts.

export const updateKinds = ['experience', 'script'] as const
export type UpdateKind = (typeof updateKinds)[number]

/** Published posts whose project anyone may see, newest first. */
export async function listUpdates(options: {
  kind?: UpdateKind
  game?: Game
  limit: number
}) {
  const where = and(
    eq(updates.status, 'published'),
    isNull(updates.deletedAt),
    or(visible, snippetVisible),
    options.kind === 'experience' ? isNotNull(updates.experienceId) : undefined,
    options.kind === 'script' ? isNotNull(updates.snippetId) : undefined,
    // Scripts belong to no game, so a game leaves them out.
    options.game ? eq(experiences.game, options.game) : undefined,
  )
  const [rows, [matching]] = await Promise.all([
    db
      .select({
        id: updates.id,
        title: updates.title,
        bodyMd: updates.bodyMd,
        publishedAt: updates.publishedAt,
        author: personColumns,
        experienceSlug: experiences.slug,
        experienceTitle: experiences.title,
        experienceCover: experiences.coverImgUrl,
        experienceGame: experiences.game,
        snippetSlug: snippets.slug,
        snippetTitle: snippets.title,
      })
      .from(updates)
      .innerJoin(user, eq(user.id, updates.authorId))
      .leftJoin(experiences, eq(experiences.id, updates.experienceId))
      .leftJoin(snippets, eq(snippets.id, updates.snippetId))
      .where(where)
      .orderBy(desc(updates.publishedAt), desc(updates.id))
      .limit(options.limit),
    db
      .select({ value: count() })
      .from(updates)
      .leftJoin(experiences, eq(experiences.id, updates.experienceId))
      .leftJoin(snippets, eq(snippets.id, updates.snippetId))
      .where(where),
  ])

  return {
    total: matching.value,
    items: rows.map((update) => ({
      id: update.id,
      title: update.title,
      excerpt: excerpt(update.bodyMd),
      publishedAt: update.publishedAt,
      author: publicPerson(update.author),
      project: update.experienceSlug
        ? {
            kind: 'experience' as const,
            slug: update.experienceSlug,
            title: update.experienceTitle ?? '',
            coverImgUrl: update.experienceCover,
            game: update.experienceGame,
          }
        : {
            kind: 'script' as const,
            slug: update.snippetSlug ?? '',
            title: update.snippetTitle ?? '',
            coverImgUrl: null,
            game: null,
          },
    })),
  }
}

export type UpdateItem = Awaited<
  ReturnType<typeof listUpdates>
>['items'][number]
