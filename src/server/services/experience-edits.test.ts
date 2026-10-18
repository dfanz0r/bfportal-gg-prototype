import { and, eq, ne } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { CHANGED_SINCE_OPENED } from '../../shared/decision'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import {
  experienceCreators,
  experiences,
  experienceTags,
  revisions,
  user,
} from '../db/schema'
import type { Lookup } from '../integrations/gametools'
import { getExperience } from './experience'
import { saveExperienceDraft } from './experience-drafts'
import { submitExperience } from './experience-submissions'
import { decideEdit, getEditReview, listQueue } from './moderation'
import { getDraftEditPage } from './submit-page'
import { offerAsTemplate } from './template-offers'

const NOW = new Date('2026-10-17T12:00:00Z')
const SLUG = 'air-vehicle-sandbox'
const moderator: Actor = { id: 'seed-kestrel', role: 'moderator' }
const nobody = {
  lookup: async (): Promise<Lookup> => ({ status: 'unavailable' }),
  now: NOW,
}

const live = async () =>
  (
    await db
      .select({
        id: experiences.id,
        ownerId: experiences.ownerId,
        title: experiences.title,
        descriptionMd: experiences.descriptionMd,
        descriptionHtml: experiences.descriptionHtml,
        status: experiences.status,
        isTemplate: experiences.isTemplate,
      })
      .from(experiences)
      .where(eq(experiences.slug, SLUG))
  )[0]

const pending = async (id: number) =>
  db
    .select({ id: revisions.id, version: revisions.version })
    .from(revisions)
    .where(and(eq(revisions.experienceId, id), eq(revisions.status, 'pending')))

/**
 * The edit form for it, as it opens for its owner. One from the old site
 * never said how it splits its teams, which the form needs.
 */
async function formFor(owner: Actor): Promise<Record<string, unknown>> {
  const page = await getDraftEditPage(owner, SLUG, {}, nobody)
  if (page.state !== 'ok' || !page.draft) throw new Error('expected the form')
  return {
    teamPlayers: ['16', '16'],
    ...page.draft.fields,
    editing: SLUG,
  }
}

describe('editing a live experience', () => {
  let owner: Actor

  beforeAll(async () => {
    await seed(db, NOW)
    owner = { id: (await live()).ownerId, role: 'user' }
  })

  afterAll(async () => {
    await sql.end()
  })

  it('is for its owner alone', async () => {
    const fields = await formFor(owner)
    expect(await submitExperience(null, fields, nobody)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    for (const actor of [moderator, { id: 'seed-vantage', role: 'user' }]) {
      expect(await submitExperience(actor as Actor, fields, nobody)).toEqual({
        ok: false,
        reason: 'not-found',
      })
      expect(
        (await getDraftEditPage(actor as Actor, SLUG, {}, nobody)).state,
      ).toBe('not-found')
    }
  })

  it('waits beside the live page, and takes changes sent after it', async () => {
    const before = await live()
    const fields = await formFor(owner)
    expect(
      await submitExperience(
        owner,
        { ...fields, title: 'Air Vehicle Sandbox 2' },
        nobody,
      ),
    ).toEqual({ ok: true, slug: SLUG })
    // The page is as it was. Its owner is told the changes wait.
    expect(await live()).toEqual(before)
    expect((await getExperience(SLUG, NOW, owner))?.viewer.editWaiting).toBe(
      true,
    )
    const [first] = await pending(before.id)
    expect(first.version).toBe(1)

    // The form opens on what was sent, and sending again adds to it: one
    // edit, a new version, both changes in it.
    const sent = await formFor(owner)
    expect(sent.title).toBe('Air Vehicle Sandbox 2')
    expect(
      await submitExperience(
        owner,
        { ...sent, description: 'Fly anything, anywhere.' },
        nobody,
      ),
    ).toEqual({ ok: true, slug: SLUG })
    const edits = await pending(before.id)
    expect(edits).toEqual([{ id: first.id, version: 2 }])

    // Saving the form keeps it for its owner and changes nothing sent.
    expect(
      await saveExperienceDraft(
        owner,
        { ...(await formFor(owner)), title: 'Not sent' },
        NOW,
      ),
    ).toEqual({ ok: true, slug: SLUG })
    expect(await pending(before.id)).toEqual(edits)
    expect((await live()).title).toBe(before.title)

    const queue = await listQueue(moderator)
    if (!queue.ok) throw new Error('expected the queue')
    expect(queue.edits.find((item) => item.id === first.id)).toMatchObject({
      changes: ['Changes to its page'],
    })
    const review = await getEditReview(moderator, first.id)
    if (!review.ok) throw new Error('expected the review')
    expect(review.edit.version).toBe(2)
    // From the old site, it never said how its teams split or whether it may
    // be copied; the form says both. Its maps stay: Portal did not answer.
    expect(review.edit.changes.map((change) => change.field)).toEqual([
      'Title',
      'Description',
      'Teams',
      'Copying in the Portal editor',
    ])
    expect(review.edit.changes[0]).toMatchObject({
      live: before.title,
      proposed: 'Air Vehicle Sandbox 2',
    })
    expect(review.edit.unchanged).toContain('category')
  })

  it('refuses a decision on a version its owner has replaced', async () => {
    const { id } = await live()
    const [edit] = await pending(id)
    const shown = edit.version
    // The template switch joins the same edit, and moves its version on.
    await db
      .update(experiences)
      .set({ filesUrl: 'https://www.dropbox.com/s/abc/files.zip' })
      .where(eq(experiences.id, id))
    expect(await offerAsTemplate(owner, SLUG, true, NOW)).toEqual({
      ok: true,
      state: 'requested',
    })
    expect(await pending(id)).toEqual([{ id: edit.id, version: shown + 1 }])
    expect(
      await decideEdit(
        moderator,
        edit.id,
        { approve: true, version: shown },
        NOW,
      ),
    ).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { form: CHANGED_SINCE_OPENED },
    })
    expect((await live()).title).not.toBe('Air Vehicle Sandbox 2')
  })

  it('writes everything asked for to the page once approved', async () => {
    const { id } = await live()
    // What Portal said about it, which an edit made while Portal does not
    // answer leaves as it is.
    const portalFacts = async () => ({
      ...(
        await db
          .select({
            mapRotation: experiences.mapRotation,
            playgroundId: experiences.playgroundId,
            portalState: experiences.portalState,
          })
          .from(experiences)
          .where(eq(experiences.id, id))
      )[0],
      tags: (
        await db
          .select({ tagId: experienceTags.tagId })
          .from(experienceTags)
          .where(
            and(
              eq(experienceTags.experienceId, id),
              ne(experienceTags.source, 'creator'),
            ),
          )
          .orderBy(experienceTags.tagId)
      ).map((row) => row.tagId),
    })
    const before = await portalFacts()
    expect(before.mapRotation).not.toBeNull()
    // Someone credited who had already said yes stays credited as they were.
    const [credited] = await db
      .select({ id: user.id, discordId: user.discordId })
      .from(user)
      .where(and(eq(user.id, 'seed-vantage'), eq(user.hideUsername, false)))
    await db.insert(experienceCreators).values({
      experienceId: id,
      userId: credited.id,
      acceptedAt: NOW,
      position: 0,
    })
    expect(
      await submitExperience(
        owner,
        {
          ...(await formFor(owner)),
          title: 'Air Vehicle Sandbox 2',
          description: 'Fly anything, anywhere.',
          creditAccounts: [credited.discordId],
        },
        nobody,
      ),
    ).toEqual({ ok: true, slug: SLUG })
    const [edit] = await pending(id)
    expect(
      await decideEdit(
        moderator,
        edit.id,
        { approve: true, version: edit.version },
        NOW,
      ),
    ).toEqual({ ok: true, slug: SLUG, status: 'approved' })
    expect(await live()).toMatchObject({
      title: 'Air Vehicle Sandbox 2',
      descriptionMd: 'Fly anything, anywhere.',
      descriptionHtml: '<p>Fly anything, anywhere.</p>',
      status: 'published',
      isTemplate: true,
    })
    const [kept] = await db
      .select({ acceptedAt: experienceCreators.acceptedAt })
      .from(experienceCreators)
      .where(
        and(
          eq(experienceCreators.experienceId, id),
          eq(experienceCreators.userId, credited.id),
        ),
      )
    expect(kept.acceptedAt).toEqual(NOW)
    expect(await portalFacts()).toEqual(before)
    expect(await pending(id)).toEqual([])
    expect((await getExperience(SLUG, NOW, owner))?.viewer.editWaiting).toBe(
      false,
    )
  })

  it('opens one sent back with its note, to fix and send again', async () => {
    const { id } = await live()
    await submitExperience(
      owner,
      { ...(await formFor(owner)), title: 'Too Short' },
      nobody,
    )
    const [edit] = await pending(id)
    await decideEdit(
      moderator,
      edit.id,
      { approve: false, note: 'Keep the old name.', version: edit.version },
      NOW,
    )
    const page = await getDraftEditPage(owner, SLUG, {}, nobody)
    if (page.state !== 'ok') throw new Error('expected the form')
    expect(page.editing).toMatchObject({
      status: 'published',
      reviewNote: 'Keep the old name.',
      editWaiting: false,
    })
    expect(page.draft?.fields.title).toBe('Too Short')
    expect(
      await submitExperience(
        owner,
        { ...(await formFor(owner)), title: 'Air Vehicle Sandbox 3' },
        nobody,
      ),
    ).toEqual({ ok: true, slug: SLUG })
    expect(await pending(id)).toHaveLength(1)
  })

  it('does not keep what Portal said about a code that was replaced', async () => {
    const { id } = await live()
    await db
      .update(experiences)
      .set({ playgroundId: 'old-playground', portalState: 'published' })
      .where(eq(experiences.id, id))
    // A new code, while Portal does not answer: nothing is known about it.
    await submitExperience(
      owner,
      { ...(await formFor(owner)), code: 'zzzzz' },
      nobody,
    )
    const [edit] = await pending(id)
    await decideEdit(
      moderator,
      edit.id,
      { approve: true, version: edit.version },
      NOW,
    )
    const [after] = await db
      .select({
        code: experiences.code,
        playgroundId: experiences.playgroundId,
        portalState: experiences.portalState,
        mapRotation: experiences.mapRotation,
      })
      .from(experiences)
      .where(eq(experiences.id, id))
    expect(after).toEqual({
      code: 'zzzzz',
      playgroundId: null,
      portalState: 'unchecked',
      mapRotation: null,
    })
  })
})
