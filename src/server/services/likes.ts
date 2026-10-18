import { and, count, eq } from 'drizzle-orm'

import { type Refusal, refuse } from '../../shared/results'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  experienceLikes,
  experiences,
  snippetLikes,
  snippets,
} from '../db/schema'
import { visible } from './experience-cards'
import { snippetVisible } from './snippets'

/**
 * Likes or unlikes an experience for whoever is acting. Anyone signed in may
 * like anything the public can see, their own included. Asking twice changes
 * nothing the second time.
 */
export async function setLike(
  actor: Actor | null,
  slug: string,
  liked: boolean,
): Promise<{ ok: true; liked: boolean; likes: number } | Refusal> {
  if (!actor) return refuse('signed-out')
  const [experience] = await db
    .select({ id: experiences.id })
    .from(experiences)
    .where(and(eq(experiences.slug, slug), visible))
    .limit(1)
  if (!experience) return refuse('not-found')

  if (liked) {
    await db
      .insert(experienceLikes)
      .values({ experienceId: experience.id, userId: actor.id })
      .onConflictDoNothing()
  } else {
    await db
      .delete(experienceLikes)
      .where(
        and(
          eq(experienceLikes.experienceId, experience.id),
          eq(experienceLikes.userId, actor.id),
        ),
      )
  }
  const [total] = await db
    .select({ value: count() })
    .from(experienceLikes)
    .where(eq(experienceLikes.experienceId, experience.id))
  return { ok: true, liked, likes: total.value }
}

/** The same for a snippet, under the same rules. */
export async function setSnippetLike(
  actor: Actor | null,
  slug: string,
  liked: boolean,
): Promise<{ ok: true; liked: boolean; likes: number } | Refusal> {
  if (!actor) return refuse('signed-out')
  const [snippet] = await db
    .select({ id: snippets.id })
    .from(snippets)
    .where(and(eq(snippets.slug, slug), snippetVisible))
    .limit(1)
  if (!snippet) return refuse('not-found')

  if (liked) {
    await db
      .insert(snippetLikes)
      .values({ snippetId: snippet.id, userId: actor.id })
      .onConflictDoNothing()
  } else {
    await db
      .delete(snippetLikes)
      .where(
        and(
          eq(snippetLikes.snippetId, snippet.id),
          eq(snippetLikes.userId, actor.id),
        ),
      )
  }
  const [total] = await db
    .select({ value: count() })
    .from(snippetLikes)
    .where(eq(snippetLikes.snippetId, snippet.id))
  return { ok: true, liked, likes: total.value }
}
