import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'

import type { ContentStatus, Game } from '../../shared/content'
import { refuse } from '../../shared/results'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experiences, revisions, snippets } from '../db/schema'
import { EDITABLE } from './experience-drafts'
import { MAX_WAITING } from './submission-limits'

// "Your submissions": everything someone has made here and the state of each,
// for them alone. Three things are said about each, kept apart so one is not
// read as another: what it is now (its listing), what was last sent to the
// moderators about it (its request), and where that stands (its review). See
// "Submission states" in PLAN.md.

/** What it is now, to its owner. Anything not yet approved is a draft. */
const LISTINGS: Record<
  ContentStatus,
  'Draft' | 'Live' | 'Delisted' | 'Removed'
> = {
  draft: 'Draft',
  pending: 'Draft',
  changes_requested: 'Draft',
  published: 'Live',
  unpublished: 'Delisted',
  removed: 'Removed',
}

type Review = 'In review' | 'Changes requested'

export type OwnSubmission = {
  key: string
  kind: 'experience' | 'snippet'
  game: Game
  title: string
  /** Its own page, where it can be seen as it is. */
  href: string
  /** Where its next step is taken, if it has one that can be taken here. */
  editHref: string | null
  image: string | null
  listing: (typeof LISTINGS)[ContentStatus]
  request: 'Submission' | 'Edit' | null
  review: Review | null
  /** What last happened to it, and when. */
  happened: {
    what:
      | 'saved'
      | 'submitted'
      | 'reviewed'
      | 'published'
      | 'delisted'
      | 'removed'
    at: Date | null
    /** Its place in the queue, while it waits there. */
    place?: { at: number; of: number }
  }
  changedAt: Date
}

/** How a submission's own review stands, by its status. */
const reviewOf = (status: ContentStatus): Review | null =>
  status === 'pending'
    ? 'In review'
    : status === 'changes_requested'
      ? 'Changes requested'
      : null

/**
 * Everything whoever is acting has made, most recently changed first, and
 * how many have changes requested.
 */
export async function listOwnSubmissions(actor: Actor | null) {
  if (!actor) return refuse('signed-out')
  const notDeleted = (table: typeof experiences | typeof snippets) =>
    and(eq(table.ownerId, actor.id), isNull(table.deletedAt))

  const [ownExperiences, ownSnippets, queue] = await Promise.all([
    db
      .select({
        id: experiences.id,
        slug: experiences.slug,
        game: experiences.game,
        title: experiences.title,
        status: experiences.status,
        coverImgUrl: experiences.coverImgUrl,
        submittedAt: experiences.submittedAt,
        reviewedAt: experiences.reviewedAt,
        publishedAt: experiences.firstPublishedAt,
        updatedAt: experiences.updatedAt,
      })
      .from(experiences)
      .where(notDeleted(experiences)),
    db
      .select({
        id: snippets.id,
        slug: snippets.slug,
        title: snippets.title,
        status: snippets.status,
        submittedAt: snippets.submittedAt,
        reviewedAt: snippets.reviewedAt,
        publishedAt: snippets.firstPublishedAt,
        updatedAt: snippets.updatedAt,
      })
      .from(snippets)
      .where(notDeleted(snippets)),
    // When each waiting submission went in, of every kind, for a place in
    // the queue. Only the times: whose they are is not anyone else's to see.
    db.execute<{ submitted_at: string }>(
      sql`select submitted_at from ${experiences} where status = 'pending' and deleted_at is null
          union all
          select submitted_at from ${snippets} where status = 'pending' and deleted_at is null`,
    ),
  ])
  const waitingSince = [...queue].map((row) => new Date(row.submitted_at))
  const placeOf = (at: Date) => ({
    at: waitingSince.filter((since) => since <= at).length,
    of: waitingSince.length,
  })

  // The latest edit of each live experience, where there is one.
  const live = ownExperiences
    .filter((item) => item.status === 'published')
    .map((item) => item.id)
  const edits =
    live.length > 0
      ? await db
          .selectDistinctOn([revisions.experienceId], {
            experienceId: revisions.experienceId,
            status: revisions.status,
            submittedAt: revisions.submittedAt,
            reviewedAt: revisions.reviewedAt,
          })
          .from(revisions)
          .where(
            and(
              inArray(revisions.experienceId, live),
              eq(revisions.kind, 'edit'),
              or(
                eq(revisions.status, 'pending'),
                eq(revisions.status, 'changes_requested'),
              ),
            ),
          )
          .orderBy(revisions.experienceId, desc(revisions.submittedAt))
      : []
  const editOf = new Map(edits.map((edit) => [edit.experienceId, edit]))

  const happenedTo = (item: {
    status: ContentStatus
    submittedAt: Date
    reviewedAt: Date | null
    publishedAt: Date | null
    updatedAt: Date
  }): OwnSubmission['happened'] => {
    switch (item.status) {
      case 'draft':
        return { what: 'saved', at: item.updatedAt }
      case 'pending':
        return {
          what: 'submitted',
          at: item.submittedAt,
          place: placeOf(item.submittedAt),
        }
      case 'changes_requested':
        return { what: 'reviewed', at: item.reviewedAt }
      case 'published':
        return { what: 'published', at: item.publishedAt }
      case 'unpublished':
        return { what: 'delisted', at: item.updatedAt }
      case 'removed':
        return { what: 'removed', at: item.reviewedAt }
    }
  }

  const items: OwnSubmission[] = [
    ...ownExperiences.map((item): OwnSubmission => {
      const edit = editOf.get(item.id)
      return {
        key: `experience-${item.id}`,
        kind: 'experience',
        game: item.game,
        title: item.title,
        href: `/experiences/${item.slug}`,
        // Edited in the form: a draft, one sent back, one in review, which
        // is then reviewed again, and one that is live, by an edit.
        editHref: EDITABLE.some((status) => status === item.status)
          ? `/experiences/${item.slug}/edit`
          : null,
        image: item.coverImgUrl,
        listing: LISTINGS[item.status],
        request: edit ? 'Edit' : reviewOf(item.status) ? 'Submission' : null,
        review: edit
          ? edit.status === 'pending'
            ? 'In review'
            : 'Changes requested'
          : reviewOf(item.status),
        happened: edit
          ? edit.status === 'pending'
            ? { what: 'submitted', at: edit.submittedAt }
            : { what: 'reviewed', at: edit.reviewedAt }
          : happenedTo(item),
        changedAt: item.updatedAt,
      }
    }),
    ...ownSnippets.map(
      (item): OwnSubmission => ({
        key: `snippet-${item.id}`,
        kind: 'snippet',
        // Snippets are for the one game that has them.
        game: 'bf6',
        title: item.title,
        href: `/snippets/${item.slug}`,
        editHref: null,
        image: null,
        listing: LISTINGS[item.status],
        request: reviewOf(item.status) ? 'Submission' : null,
        review: reviewOf(item.status),
        happened: happenedTo(item),
        changedAt: item.updatedAt,
      }),
    ),
  ].sort((one, other) => other.changedAt.getTime() - one.changedAt.getTime())

  return {
    ok: true as const,
    items,
    tally: tallyOf(items),
    now: new Date(),
  }
}

/** How many of someone's are at each step, for the submit form's side. */
function tallyOf(items: OwnSubmission[]) {
  const waiting = items.filter(
    (item) => item.request === 'Submission' && item.review === 'In review',
  ).length
  return {
    changesRequested: items.filter(
      (item) => item.review === 'Changes requested',
    ).length,
    inReview: items.filter((item) => item.review === 'In review').length,
    drafts: items.filter(
      (item) => item.listing === 'Draft' && item.request === null,
    ).length,
    waiting,
    maxWaiting: MAX_WAITING,
  }
}

/** The same counts alone. */
export async function ownSubmissionTally(actor: Actor) {
  const listed = await listOwnSubmissions(actor)
  return listed.ok ? listed.tally : null
}
