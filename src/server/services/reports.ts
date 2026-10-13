import { and, eq } from 'drizzle-orm'

import type { ReportType } from '../../shared/content'
import { type Refusal, refuse } from '../../shared/results'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experienceReports, experiences } from '../db/schema'
import { visible } from './experience-cards'

/**
 * Records that whoever is acting found an experience bugged, not loading, or
 * an XP farm. A report changes no flag: a moderator looks at the reports and
 * decides. Its owner cannot report their own, and reporting twice counts once.
 */
export async function reportExperience(
  actor: Actor | null,
  slug: string,
  type: ReportType,
): Promise<{ ok: true } | Refusal> {
  if (!actor) return refuse('signed-out')
  const [experience] = await db
    .select({ id: experiences.id, ownerId: experiences.ownerId })
    .from(experiences)
    .where(and(eq(experiences.slug, slug), visible))
    .limit(1)
  if (!experience) return refuse('not-found')
  if (experience.ownerId === actor.id) return refuse('forbidden')

  await db
    .insert(experienceReports)
    .values({ experienceId: experience.id, userId: actor.id, type })
    .onConflictDoNothing()
  return { ok: true }
}
