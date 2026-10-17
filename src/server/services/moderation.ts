import { and, asc, count, eq, isNull, ne, notInArray, sql } from 'drizzle-orm'

import { NOTE_NEEDED } from '../../shared/decision'
import { shownMedia } from '../../shared/media'
import { type Refusal, refuse } from '../../shared/results'
import { isStaff } from '../../shared/roles'
import { teamSetupSchema } from '../../shared/teams'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import {
  categories,
  experienceMedia,
  experiences,
  projectFiles,
  revisions,
  snippets,
  user,
} from '../db/schema'
import { lookupExperience } from '../integrations/gametools'
import { pictureHosts } from '../markdown'
import { type EditPayload, editPayloadSchema } from './template-offers'

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

const snippetWaiting = and(
  eq(snippets.status, 'pending'),
  isNull(snippets.deletedAt),
)

/**
 * Another page that still has its code: not deleted, not removed for good,
 * and not a draft, which was sent to nobody. The queue's own check says the
 * same in SQL.
 */
const holdsItsCode = and(
  isNull(experiences.deletedAt),
  notInArray(experiences.status, ['draft', 'removed']),
)

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
      sameCode: sql<boolean>`exists (select 1 from ${experiences} as other where other.game = ${experiences.game} and other.code = ${experiences.code} and other.id <> ${experiences.id} and other.deleted_at is null and other.status not in ('draft', 'removed'))`,
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
  // Snippets wait in the same queue. Each is reviewed on its own page.
  const waitingSnippets = await db
    .select({
      id: snippets.id,
      slug: snippets.slug,
      title: snippets.title,
      category: categories.name,
      submittedAt: snippets.submittedAt,
      ownerName: user.name,
      ownerImage: user.image,
    })
    .from(snippets)
    .innerJoin(user, eq(user.id, snippets.ownerId))
    .leftJoin(categories, eq(categories.id, snippets.categoryId))
    .where(snippetWaiting)
    .orderBy(asc(snippets.submittedAt), asc(snippets.id))
    .limit(QUEUE_PAGE)
  // Changes to something already published, each reviewed on its own screen.
  const waitingEdits = await db
    .select({
      id: revisions.id,
      payload: revisions.payload,
      submittedAt: revisions.submittedAt,
      title: experiences.title,
      ownerName: user.name,
      ownerImage: user.image,
    })
    .from(revisions)
    .innerJoin(experiences, eq(experiences.id, revisions.experienceId))
    .innerJoin(user, eq(user.id, revisions.submittedBy))
    .where(editWaiting)
    .orderBy(asc(revisions.submittedAt), asc(revisions.id))
    .limit(QUEUE_PAGE)
  return {
    ok: true as const,
    items: rows,
    total: total.value,
    snippets: waitingSnippets,
    edits: waitingEdits.map(({ payload, ...edit }) => ({
      ...edit,
      changes: changesIn(editPayloadSchema.catch({}).parse(payload)),
    })),
    now: new Date(),
  }
}

/** What a pending edit changes, each as the field's name. */
function changesIn(payload: EditPayload) {
  return Object.entries(EDIT_FIELDS).flatMap(([key, name]) =>
    payload[key as keyof EditPayload] === undefined ? [] : [name],
  )
}

/** The name each field an edit can change goes by. */
const EDIT_FIELDS: Record<keyof EditPayload, string> = {
  isTemplate: 'Template',
}

/**
 * An edit whose every change this site can apply. One asking for anything
 * else waits for the edit form, which is not built: approving it here would
 * mark it approved and change nothing.
 */
const appliable = sql`(${revisions.payload} - ${sql.raw(`'{${Object.keys(EDIT_FIELDS).join(',')}}'`)}::text[]) = '{}'::jsonb`

const editWaiting = and(
  eq(revisions.kind, 'edit'),
  eq(revisions.status, 'pending'),
  isNull(experiences.deletedAt),
  appliable,
)

/**
 * One pending edit, beside the page as it is live now. Its files are
 * included: an edit that offers them as a template is about them.
 */
export async function getEditReview(actor: Actor | null, id: number) {
  const refused = refusal(actor)
  if (refused) return refused
  const [found] = await db
    .select({
      id: revisions.id,
      payload: revisions.payload,
      submittedAt: revisions.submittedAt,
      experience: {
        id: experiences.id,
        slug: experiences.slug,
        title: experiences.title,
        game: experiences.game,
        isTemplate: experiences.isTemplate,
        filesUrl: experiences.filesUrl,
      },
      submitter: { name: user.name, image: user.image },
    })
    .from(revisions)
    .innerJoin(experiences, eq(experiences.id, revisions.experienceId))
    .innerJoin(user, eq(user.id, revisions.submittedBy))
    .where(and(eq(revisions.id, id), editWaiting))
    .limit(1)
  if (!found) return refuse('not-found')
  const payload = editPayloadSchema.catch({}).parse(found.payload)
  const files = await db
    .select({
      // The one its addresses use.
      id: projectFiles.publicId,
      kind: projectFiles.kind,
      filename: projectFiles.filename,
      sizeBytes: projectFiles.sizeBytes,
      fromExport: projectFiles.fromExport,
    })
    .from(projectFiles)
    .where(eq(projectFiles.experienceId, found.experience.id))
    .orderBy(asc(projectFiles.id))
  const yesNo = (value: boolean) => (value ? 'Yes' : 'No')
  return {
    ok: true as const,
    edit: {
      id: found.id,
      submittedAt: found.submittedAt,
      submitter: found.submitter,
      experience: found.experience,
      // Each change as its field, what is live and what is asked for.
      changes:
        payload.isTemplate === undefined
          ? []
          : [
              {
                field: EDIT_FIELDS.isTemplate,
                live: yesNo(found.experience.isTemplate),
                proposed: payload.isTemplate
                  ? 'Yes: anyone can download its files'
                  : 'No',
              },
            ],
      files,
    },
    now: new Date(),
  }
}

/**
 * Approves a pending edit, which applies what it changes to the live page, or
 * sends it back with a note. Decided once, as a submission is.
 */
export async function decideEdit(
  actor: Actor | null,
  id: number,
  decision: { approve: boolean; note?: string },
  now = new Date(),
): Promise<
  { ok: true; slug: string; status: 'approved' | 'changes_requested' } | Refusal
> {
  const refused = refusal(actor)
  if (refused || !actor) return refused ?? refuse('signed-out')
  const note = decision.note?.trim() ?? ''
  if (!decision.approve && note.length < 3) {
    return refuse('invalid', { note: NOTE_NEEDED })
  }
  const status = decision.approve ? 'approved' : 'changes_requested'
  return db.transaction(async (tx) => {
    // The condition is in the update, so two moderators cannot both decide.
    const [decided] = await tx
      .update(revisions)
      .set({
        status,
        reviewedBy: actor.id,
        reviewedAt: now,
        reviewNote: note || null,
      })
      .where(
        and(
          eq(revisions.id, id),
          eq(revisions.kind, 'edit'),
          eq(revisions.status, 'pending'),
          appliable,
        ),
      )
      .returning({
        experienceId: revisions.experienceId,
        payload: revisions.payload,
      })
    if (!decided) return refuse('not-found')
    // Only the fields an edit may change, as the schema reads them.
    const payload = editPayloadSchema.catch({}).parse(decided.payload)
    if (decision.approve && Object.keys(payload).length > 0) {
      await tx
        .update(experiences)
        .set(payload)
        .where(eq(experiences.id, decided.experienceId))
    }
    const [experience] = await tx
      .select({ slug: experiences.slug })
      .from(experiences)
      .where(eq(experiences.id, decided.experienceId))
    return { ok: true as const, slug: experience.slug, status }
  })
}

/**
 * Approves a waiting snippet, or sends it back with changes requested. The
 * same rules as for an experience: approving publishes it, requesting changes
 * needs a note, and it is decided once each time it is sent in.
 */
export async function decideSnippet(
  actor: Actor | null,
  id: number,
  decision: { approve: boolean; note?: string },
  now = new Date(),
): Promise<
  | { ok: true; slug: string; status: 'published' | 'changes_requested' }
  | Refusal
> {
  const refused = refusal(actor)
  if (refused || !actor) return refused ?? refuse('signed-out')
  const note = decision.note?.trim() ?? ''
  if (!decision.approve && note.length < 3) {
    return refuse('invalid', { note: NOTE_NEEDED })
  }

  const status = decision.approve ? 'published' : 'changes_requested'
  // The condition is in the update itself, so two moderators deciding at
  // once cannot both succeed.
  const [decided] = await db
    .update(snippets)
    .set({
      status,
      reviewedBy: actor.id,
      reviewedAt: now,
      reviewNote: note || null,
      ...(decision.approve
        ? { firstPublishedAt: now, lastPublishedAt: now }
        : {}),
    })
    .where(and(eq(snippets.id, id), snippetWaiting))
    .returning({ slug: snippets.slug })
  return decided
    ? { ok: true, slug: decided.slug, status }
    : refuse('not-found')
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

  const [mediaRows, files, sameCode, history, looked] = await Promise.all([
    db
      .select({ url: experienceMedia.url })
      .from(experienceMedia)
      .where(eq(experienceMedia.experienceId, experience.id))
      .orderBy(asc(experienceMedia.position)),
    // Its files, which are reviewed with it.
    db
      .select({
        // The one its addresses use.
        id: projectFiles.publicId,
        kind: projectFiles.kind,
        filename: projectFiles.filename,
        sizeBytes: projectFiles.sizeBytes,
        fromExport: projectFiles.fromExport,
      })
      .from(projectFiles)
      .where(eq(projectFiles.experienceId, experience.id))
      .orderBy(asc(projectFiles.id)),
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
              holdsItsCode,
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
  const media = shownMedia(mediaRows.map((row) => row.url))
  // Every picture the page will load: the description's, the cover and the
  // gallery. Each is fetched by every visitor's browser. A video's thumbnail
  // comes from YouTube, whoever posted it.
  const pictures = new Set(pictureHosts(experience.descriptionHtml))
  for (const address of [
    experience.coverImgUrl,
    ...media.flatMap((item) => (item.kind === 'image' ? [item.url] : [])),
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
      teams: teamSetupSchema.safeParse(experience.teamSetup).data ?? [],
      types: experience.types,
      isTemplate: experience.isTemplate,
      repoUrl: experience.repoUrl,
      filesUrl: experience.filesUrl,
      media,
      files,
      submittedAt: experience.submittedAt,
    },
    submitter: {
      name: found.owner.name,
      image: found.owner.image,
      discordId: found.owner.discordId,
      joinedAt: found.owner.joinedAt,
      published: earlier('published'),
      changesRequested: earlier('changes_requested'),
      removed: earlier('removed'),
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
 * Approves a waiting submission, or sends it back with changes requested.
 * Approving publishes it. Requesting changes needs a note for its creator,
 * who can then fix it and send it in again. A submission is decided once each
 * time it is sent in.
 *
 * Not here yet: notes on particular fields (`review_field_notes`), and
 * removing a submission for good (`removed`).
 */
export async function decideSubmission(
  actor: Actor | null,
  id: number,
  decision: { approve: boolean; note?: string },
  now = new Date(),
): Promise<
  | { ok: true; slug: string; status: 'published' | 'changes_requested' }
  | Refusal
> {
  const refused = refusal(actor)
  if (refused || !actor) return refused ?? refuse('signed-out')
  const note = decision.note?.trim() ?? ''
  if (!decision.approve && note.length < 3) {
    return refuse('invalid', { note: NOTE_NEEDED })
  }

  const status = decision.approve ? 'published' : 'changes_requested'
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
