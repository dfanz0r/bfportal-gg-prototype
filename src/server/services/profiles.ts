import {
  and,
  count,
  desc,
  eq,
  exists,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm'

import { FEED_PAGE_SIZE, type ProfileTab } from '../../shared/feed-search'
import { db } from '../db'
import {
  experienceCreators,
  experienceLikes,
  experiences,
  siteSettings,
  snippets,
  updates,
  user,
} from '../db/schema'
import { likes, listCards, visible } from './experience-cards'
import { listSnippets, snippetVisible } from './snippets'

// A person's public profile: who they are and what they have shared.

/** Whether profiles are for signed-in visitors only. */
export async function profilesNeedLogin() {
  const [settings] = await db
    .select({ needLogin: siteSettings.needLoginToViewProfile })
    .from(siteSettings)
    .limit(1)
  return settings?.needLogin ?? false
}

/** Null if there is no such account. */
export async function getProfile(
  discordId: string,
  tab: ProfileTab,
  page = 1,
  /** Who is looking, for the experiences they like. */
  viewer: string | null = null,
) {
  const [person] = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      role: user.role,
      hidden: user.hideUsername,
      joinedAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.discordId, discordId))
    .limit(1)
  if (!person) return null

  // Theirs: what they own, and what they are credited on and have accepted.
  const theirs = and(
    visible,
    or(
      eq(experiences.ownerId, person.id),
      exists(
        db
          .select({ one: sql`1` })
          .from(experienceCreators)
          .where(
            and(
              eq(experienceCreators.experienceId, experiences.id),
              eq(experienceCreators.userId, person.id),
              isNotNull(experienceCreators.acceptedAt),
            ),
          ),
      ),
    ),
  )
  const liked = and(
    visible,
    exists(
      db
        .select({ one: sql`1` })
        .from(experienceLikes)
        .where(
          and(
            eq(experienceLikes.experienceId, experiences.id),
            eq(experienceLikes.userId, person.id),
          ),
        ),
    ),
  )

  const [[made], [shared], [received], [posted], [likedCount]] =
    await Promise.all([
      db.select({ value: count() }).from(experiences).where(theirs),
      db
        .select({ value: count() })
        .from(snippets)
        .where(and(snippetVisible, eq(snippets.ownerId, person.id))),
      db
        .select({ value: count() })
        .from(experienceLikes)
        .innerJoin(
          experiences,
          eq(experiences.id, experienceLikes.experienceId),
        )
        .where(and(visible, eq(experiences.ownerId, person.id))),
      // The same posts the updates feed would show.
      db
        .select({ value: count() })
        .from(updates)
        .leftJoin(experiences, eq(experiences.id, updates.experienceId))
        .leftJoin(snippets, eq(snippets.id, updates.snippetId))
        .where(
          and(
            eq(updates.authorId, person.id),
            eq(updates.status, 'published'),
            isNull(updates.deletedAt),
            or(visible, snippetVisible),
          ),
        ),
      db.select({ value: count() }).from(experiences).where(liked),
    ])

  // "Show more" grows the page: page two holds the first two pages.
  const limit = page * FEED_PAGE_SIZE
  const cards =
    tab === 'snippets'
      ? []
      : await listCards({
          where: tab === 'liked' ? liked : theirs,
          orderBy: [desc(likes), desc(experiences.id)],
          limit,
          viewer,
        })
  const snippetItems =
    tab === 'snippets'
      ? (await listSnippets({ ownerId: person.id, limit, viewer })).items
      : []

  return {
    discordId,
    // Someone who hides their name is not named on their profile either.
    name: person.hidden ? null : person.name,
    image: person.hidden ? null : person.image,
    role: person.role,
    joinedAt: person.joinedAt,
    counts: {
      experiences: made.value,
      snippets: shared.value,
      liked: likedCount.value,
      likesReceived: received.value,
      updates: posted.value,
    },
    tab,
    page,
    cards,
    snippets: snippetItems,
  }
}
