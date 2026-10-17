import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { experiences, projectFiles, revisions } from '../db/schema'
import { decideEdit, getEditReview, listQueue } from './moderation'
import { offerAsTemplate, templateRequestOf } from './template-offers'

const NOW = new Date('2026-10-16T12:00:00Z')
const moderator: Actor = { id: 'seed-kestrel', role: 'moderator' }
const stranger: Actor = { id: 'seed-recruit-05', role: 'user' }

/**
 * A live experience of `game` that is not a template, given its owner and,
 * with `files`, an export kept from when it was submitted.
 */
async function liveExperience(game: 'bf6' | 'bf2042', files: boolean) {
  const [row] = await db
    .select({
      id: experiences.id,
      slug: experiences.slug,
      ownerId: experiences.ownerId,
    })
    .from(experiences)
    .where(
      and(
        eq(experiences.game, game),
        eq(experiences.status, 'published'),
        eq(experiences.isTemplate, false),
      ),
    )
    .orderBy(experiences.id)
    .limit(1)
  await db
    .update(experiences)
    .set({ filesUrl: null })
    .where(eq(experiences.id, row.id))
  await db.delete(projectFiles).where(eq(projectFiles.experienceId, row.id))
  if (files) {
    await db.insert(projectFiles).values({
      experienceId: row.id,
      kind: 'export',
      filename: 'mode.json',
      sizeBytes: 2,
      sha256: 'x',
      body: '{}',
      uploadedBy: row.ownerId,
    })
  }
  const owner: Actor = { id: row.ownerId, role: 'user' }
  return { ...row, owner }
}

const isTemplate = async (id: number) =>
  (
    await db
      .select({ value: experiences.isTemplate })
      .from(experiences)
      .where(eq(experiences.id, id))
  )[0].value

const pendingEdits = (id: number) =>
  db
    .select({ id: revisions.id, payload: revisions.payload })
    .from(revisions)
    .where(and(eq(revisions.experienceId, id), eq(revisions.status, 'pending')))

describe('offering files as a template after submitting', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('is for its owner alone, where the game exports files, and when there are files', async () => {
    const { slug, owner } = await liveExperience('bf6', false)
    expect(await offerAsTemplate(null, slug, true, NOW)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    // Someone else's is not found, as far as they can tell.
    expect(await offerAsTemplate(stranger, slug, true, NOW)).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(await offerAsTemplate(moderator, slug, true, NOW)).toEqual({
      ok: false,
      reason: 'not-found',
    })
    expect(await offerAsTemplate(owner, slug, true, NOW)).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { form: 'It has no files to offer.' },
    })

    const other = await liveExperience('bf2042', true)
    expect(
      await offerAsTemplate(other.owner, other.slug, true, NOW),
    ).toMatchObject({
      ok: false,
      errors: { form: expect.stringContaining('chosen by its category') },
    })
  })

  it('asks a moderator before offering the files of something live', async () => {
    const { id, slug, owner } = await liveExperience('bf6', true)

    expect(await offerAsTemplate(owner, slug, true, NOW)).toEqual({
      ok: true,
      state: 'requested',
    })
    expect(await isTemplate(id)).toBe(false)
    expect(await templateRequestOf(id)).toEqual({ waiting: true, note: null })
    // Asked twice, it is still one request.
    await offerAsTemplate(owner, slug, true, NOW)
    expect(await pendingEdits(id)).toEqual([
      { id: expect.any(Number), payload: { isTemplate: true } },
    ])

    // Taken back before anyone decided: gone from the queue.
    expect(await offerAsTemplate(owner, slug, false, NOW)).toEqual({
      ok: true,
      state: 'withdrawn',
    })
    expect(await pendingEdits(id)).toEqual([])
    expect(await templateRequestOf(id)).toBeNull()
  })

  it('does not offer them while it is in review, but stops offering them', async () => {
    const { id, slug, owner } = await liveExperience('bf6', true)
    await db
      .update(experiences)
      .set({ status: 'pending' })
      .where(eq(experiences.id, id))
    // The moderator decides on it with its files private.
    expect(await offerAsTemplate(owner, slug, true, NOW)).toMatchObject({
      ok: false,
      reason: 'invalid',
    })
    expect(await isTemplate(id)).toBe(false)
    expect(await pendingEdits(id)).toEqual([])

    await db
      .update(experiences)
      .set({ isTemplate: true })
      .where(eq(experiences.id, id))
    expect(await offerAsTemplate(owner, slug, false, NOW)).toEqual({
      ok: true,
      state: 'withdrawn',
    })
    expect(await isTemplate(id)).toBe(false)
    await db
      .update(experiences)
      .set({ status: 'published' })
      .where(eq(experiences.id, id))
  })

  it('refuses one that has been deleted', async () => {
    const { id, slug, owner } = await liveExperience('bf6', true)
    await db
      .update(experiences)
      .set({ deletedAt: NOW })
      .where(eq(experiences.id, id))
    expect(await offerAsTemplate(owner, slug, false, NOW)).toMatchObject({
      ok: false,
      reason: 'not-found',
    })
    await db
      .update(experiences)
      .set({ deletedAt: null })
      .where(eq(experiences.id, id))
  })

  it('lets a moderator approve the request, or send it back with a note', async () => {
    const { id, slug, owner } = await liveExperience('bf6', true)
    await offerAsTemplate(owner, slug, true, NOW)
    const [edit] = await pendingEdits(id)

    // Only moderators and admins see or decide it.
    for (const actor of [null, owner]) {
      expect((await getEditReview(actor, edit.id)).ok).toBe(false)
      expect(
        (await decideEdit(actor, edit.id, { approve: true }, NOW)).ok,
      ).toBe(false)
    }

    const queue = await listQueue(moderator)
    if (!queue.ok) throw new Error('expected the queue')
    expect(queue.edits.find((item) => item.id === edit.id)).toMatchObject({
      changes: ['Template'],
    })
    const review = await getEditReview(moderator, edit.id)
    if (!review.ok) throw new Error('expected the review')
    expect(review.edit.changes).toEqual([
      {
        field: 'Template',
        live: 'No',
        proposed: 'Yes: anyone can download its files',
      },
    ])
    expect(review.edit.files.map((file) => file.filename)).toEqual([
      'mode.json',
    ])

    // Sent back: it needs a note, and the owner sees it.
    expect(
      await decideEdit(moderator, edit.id, { approve: false }, NOW),
    ).toMatchObject({ ok: false, errors: { note: expect.any(String) } })
    expect(
      await decideEdit(
        moderator,
        edit.id,
        { approve: false, note: 'The export has someone else’s map in it.' },
        NOW,
      ),
    ).toEqual({ ok: true, slug, status: 'changes_requested' })
    expect(await isTemplate(id)).toBe(false)
    expect(await templateRequestOf(id)).toEqual({
      waiting: false,
      note: 'The export has someone else’s map in it.',
    })

    // Asked again, and approved, once.
    await offerAsTemplate(owner, slug, true, NOW)
    const [again] = await pendingEdits(id)
    expect(
      await decideEdit(moderator, again.id, { approve: true }, NOW),
    ).toEqual({ ok: true, slug, status: 'approved' })
    expect(await isTemplate(id)).toBe(true)
    expect(await templateRequestOf(id)).toBeNull()
    expect(
      (await decideEdit(moderator, again.id, { approve: true }, NOW)).ok,
    ).toBe(false)

    // An edit asking for what this site cannot apply yet waits for the edit
    // form: it is not offered, and cannot be approved into doing nothing.
    const [other] = await db
      .insert(revisions)
      .values({
        experienceId: id,
        kind: 'edit',
        payload: { title: 'A new title' },
        submittedBy: owner.id,
      })
      .returning({ id: revisions.id })
    const later = await listQueue(moderator)
    expect(later.ok && later.edits.some((item) => item.id === other.id)).toBe(
      false,
    )
    expect((await getEditReview(moderator, other.id)).ok).toBe(false)
    expect(
      (await decideEdit(moderator, other.id, { approve: true }, NOW)).ok,
    ).toBe(false)
    await db.delete(revisions).where(eq(revisions.id, other.id))

    // Taking it back needs nobody.
    expect(await offerAsTemplate(owner, slug, false, NOW)).toEqual({
      ok: true,
      state: 'withdrawn',
    })
    expect(await isTemplate(id)).toBe(false)
  })
})
