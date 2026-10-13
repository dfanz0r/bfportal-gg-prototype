import { and, asc, count, eq, isNull, ne, sql } from 'drizzle-orm'

import { type Refusal, refuse } from '../../shared/results'
import { isStaff } from '../../shared/roles'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { categories, experienceImages, experiences, user } from '../db/schema'
import { lookupExperience } from '../integrations/gametools'
import { pictureHosts } from '../markdown'

// What the moderators do: look at what is waiting, and decide. Every function
// here refuses anyone who is not a moderator or an admin.

type Lookup = typeof lookupExperience

/**
 * Hosts so many descriptions load pictures from that naming them would make
 * the warning noise. A stand-in for the list an admin will keep in settings.
 */
const FAMILIAR_PICTURE_HOSTS = [
  'i.imgur.com',
  'imgur.com',
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
  'github.com',
  'eaassets-a.akamaihd.net',
  'cdn.mcr.ea.com',
]

/** How much of the queue one screen shows. The longest waits come first. */
const QUEUE_PAGE = 100

/** Null if the actor may moderate; otherwise why not. */
function refusal(actor: Actor | null): Refusal | null {
  if (!actor) return refuse('signed-out')
  return isStaff(actor.role) ? null : refuse('forbidden')
}

const waiting = and(
  eq(experiences.status, 'pending'),
  isNull(experiences.deletedAt),
)

/** Everything waiting for a moderator, the longest wait first. */
export async function listQueue(actor: Actor | null) {
  const refused = refusal(actor)
  if (refused) return refused

  const rows = await db
    .select({
      id: experiences.id,
      slug: experiences.slug,
      title: experiences.title,
      game: experiences.game,
      types: experiences.types,
      isTemplate: experiences.isTemplate,
      submittedAt: experiences.submittedAt,
      // A moderator sees who submitted it whether or not they hide their name.
      ownerName: user.name,
      ownerImage: user.image,
      // Another page already on the same code: worth knowing before opening it.
      sameCode: sql<boolean>`exists (select 1 from ${experiences} as other where other.game = ${experiences.game} and other.code = ${experiences.code} and other.id <> ${experiences.id} and other.deleted_at is null)`,
    })
    .from(experiences)
    .innerJoin(user, eq(user.id, experiences.ownerId))
    .where(waiting)
    .orderBy(asc(experiences.submittedAt), asc(experiences.id))
    .limit(QUEUE_PAGE)
  const [total] = await db
    .select({ value: count() })
    .from(experiences)
    .where(waiting)
  return { ok: true as const, items: rows, total: total.value, now: new Date() }
}

/**
 * One waiting submission, with what a moderator should know before deciding.
 * The checks inform; none of them decides anything.
 */
export async function getSubmissionReview(
  actor: Actor | null,
  id: number,
  options: { lookup?: Lookup } = {},
) {
  const refused = refusal(actor)
  if (refused) return refused

  const [found] = await db
    .select({
      experience: experiences,
      category: categories.name,
      owner: {
        id: user.id,
        name: user.name,
        image: user.image,
        discordId: user.discordId,
        joinedAt: user.createdAt,
      },
    })
    .from(experiences)
    .innerJoin(user, eq(user.id, experiences.ownerId))
    .innerJoin(categories, eq(categories.id, experiences.categoryId))
    .where(and(eq(experiences.id, id), waiting))
    .limit(1)
  if (!found) return refuse('not-found')
  const { experience } = found

  const [gallery, sameCode, history, looked] = await Promise.all([
    db
      .select({ url: experienceImages.url })
      .from(experienceImages)
      .where(eq(experienceImages.experienceId, experience.id)),
    experience.code
      ? db
          .select({
            slug: experiences.slug,
            title: experiences.title,
            status: experiences.status,
          })
          .from(experiences)
          .where(
            and(
              eq(experiences.game, experience.game),
              eq(experiences.code, experience.code),
              ne(experiences.id, experience.id),
              isNull(experiences.deletedAt),
            ),
          )
      : [],
    db
      .select({ status: experiences.status, value: count() })
      .from(experiences)
      .where(
        and(
          eq(experiences.ownerId, found.owner.id),
          ne(experiences.id, experience.id),
          isNull(experiences.deletedAt),
        ),
      )
      .groupBy(experiences.status),
    experience.code
      ? (options.lookup ?? lookupExperience)(experience.game, {
          code: experience.code,
        })
      : null,
  ])
  const earlier = (status: string) =>
    history.find((row) => row.status === status)?.value ?? 0
  // Every picture the page will load: the description's, the cover and the
  // gallery. Each is fetched by every visitor's browser.
  const pictures = new Set(pictureHosts(experience.descriptionHtml))
  for (const address of [
    experience.coverImgUrl,
    ...gallery.map((g) => g.url),
  ]) {
    try {
      if (address) pictures.add(new URL(address).hostname)
    } catch {
      // Not an address a browser would fetch.
    }
  }

  return {
    ok: true as const,
    submission: {
      id: experience.id,
      slug: experience.slug,
      game: experience.game,
      title: experience.title,
      category: found.category,
      code: experience.code,
      descriptionHtml: experience.descriptionHtml,
      coverImgUrl: experience.coverImgUrl,
      maxPlayers: experience.maxPlayers,
      maxBots: experience.maxBots,
      types: experience.types,
      isTemplate: experience.isTemplate,
      repoUrl: experience.repoUrl,
      filesUrl: experience.filesUrl,
      vidUrl: experience.vidUrl,
      submittedAt: experience.submittedAt,
    },
    submitter: {
      name: found.owner.name,
      image: found.owner.image,
      discordId: found.owner.discordId,
      joinedAt: found.owner.joinedAt,
      published: earlier('published'),
      rejected: earlier('rejected'),
    },
    checks: {
      /** What Portal says about the code right now. */
      portal: !experience.code
        ? ('no-code' as const)
        : looked?.status === 'found'
          ? looked.experience.published
            ? ('published' as const)
            : ('unpublished' as const)
          : (looked?.status ?? ('unavailable' as const)),
      /** What Portal calls it, when that is not what the page will. */
      portalTitle:
        looked?.status === 'found' &&
        looked.experience.title.trim().toLowerCase() !==
          experience.title.trim().toLowerCase()
          ? looked.experience.title
          : null,
      sameCode,
      /** Hosts its pictures load from that are not everyday ones. */
      pictureHosts: [...pictures]
        .filter((host) => !FAMILIAR_PICTURE_HOSTS.includes(host))
        .sort(),
      hasCover: Boolean(experience.coverImgUrl),
      // A sentence or less.
      thinDescription: experience.descriptionMd.trim().length < 80,
    },
    now: new Date(),
  }
}

/**
 * Approves or turns down a waiting submission. Approving publishes it.
 * Turning it down needs a note for its creator. A submission is decided once.
 */
export async function decideSubmission(
  actor: Actor | null,
  id: number,
  decision: { approve: boolean; note?: string },
  now = new Date(),
): Promise<
  { ok: true; slug: string; status: 'published' | 'rejected' } | Refusal
> {
  const refused = refusal(actor)
  if (refused || !actor) return refused ?? refuse('signed-out')
  const note = decision.note?.trim() ?? ''
  if (!decision.approve && note.length < 3) {
    return refuse('invalid', {
      note: 'Say why, so its creator knows what to change.',
    })
  }

  const status = decision.approve ? 'published' : 'rejected'
  // The condition is in the update itself, so two moderators deciding at
  // once cannot both succeed.
  const [decided] = await db
    .update(experiences)
    .set({
      status,
      reviewedBy: actor.id,
      reviewedAt: now,
      reviewNote: note || null,
      ...(decision.approve
        ? { firstPublishedAt: now, lastPublishedAt: now }
        : {}),
    })
    .where(and(eq(experiences.id, id), waiting))
    .returning({ slug: experiences.slug })
  return decided
    ? { ok: true, slug: decided.slug, status }
    : refuse('not-found')
}
