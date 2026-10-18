import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { portalExport } from '../../../tests/portal-export'
import { CHANGED_SINCE_OPENED } from '../../shared/decision'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { experiences, heldFiles, projectFiles } from '../db/schema'
import type { Lookup } from '../integrations/gametools'
import { getExperience } from './experience'
import {
  deleteExperienceDraft,
  MAX_DRAFTS,
  saveExperienceDraft,
} from './experience-drafts'
import { submitExperience } from './experience-submissions'
import { heldFilesFor, holdFiles } from './held-files'
import { decideSubmission } from './moderation'
import { listOwnSubmissions } from './own-submissions'
import { getDraftEditPage } from './submit-page'

const NOW = new Date('2026-10-16T12:00:00Z')
const writer = (n: number): Actor => ({
  id: `seed-recruit-${String(n).padStart(2, '0')}`,
  role: 'user',
})
const moderator: Actor = { id: 'seed-kestrel', role: 'moderator' }
const nobody = {
  lookup: async (): Promise<Lookup> => ({ status: 'unavailable' }),
}

const form = (changes: Record<string, unknown> = {}) => ({
  game: 'bf6',
  category: 'multiplayer',
  title: 'Half Done',
  ...changes,
})

const row = async (slug: string) =>
  (
    await db
      .select({
        id: experiences.id,
        status: experiences.status,
        title: experiences.title,
        draftForm: experiences.draftForm,
        deletedAt: experiences.deletedAt,
      })
      .from(experiences)
      .where(eq(experiences.slug, slug))
  )[0]

describe('drafts', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('refuses a visitor, and a draft with no title or an unsafe link', async () => {
    expect(await saveExperienceDraft(null, form(), NOW)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    expect(
      await saveExperienceDraft(writer(21), form({ title: '' }), NOW),
    ).toMatchObject({ ok: false, errors: { title: expect.any(String) } })
    expect(
      await saveExperienceDraft(
        writer(21),
        form({ coverImgUrl: 'http://plain.example/a.png' }),
        NOW,
      ),
    ).toMatchObject({ ok: false, errors: { coverImgUrl: expect.any(String) } })
  })

  it('keeps a half-filled form as typed, for its owner alone', async () => {
    const owner = writer(22)
    const saved = await saveExperienceDraft(
      owner,
      form({
        code: 'not a code',
        teamPlayers: ['400'],
        description: 'So far.',
      }),
      NOW,
    )
    expect(saved).toEqual({ ok: true, slug: 'half-done' })
    expect(await row('half-done')).toMatchObject({
      status: 'draft',
      title: 'Half Done',
      draftForm: {
        fields: { code: 'not a code', teamPlayers: ['400'], game: 'bf6' },
        errors: {},
      },
    })

    // Its page is its owner's, moderators included out.
    expect(
      (await getExperience('half-done', NOW, owner))?.descriptionHtml,
    ).toBe('<p>So far.</p>')
    expect(await getExperience('half-done', NOW, moderator)).toBeNull()
    expect(await getExperience('half-done', NOW, writer(23))).toBeNull()

    // The form opens as it was left. Someone else's is not found.
    const page = await getDraftEditPage(owner, 'half-done', {}, nobody)
    if (page.state !== 'ok') throw new Error('expected the edit page')
    expect(page.draft?.fields.code).toBe('not a code')
    expect(page.editing?.slug).toBe('half-done')
    expect(
      (await getDraftEditPage(writer(23), 'half-done', {}, nobody)).state,
    ).toBe('not-found')

    // Saved again, the same draft changes.
    expect(
      await saveExperienceDraft(
        owner,
        form({ editing: 'half-done', title: 'Nearly Done' }),
        NOW,
      ),
    ).toEqual({ ok: true, slug: 'half-done' })
    expect(await row('half-done')).toMatchObject({ title: 'Nearly Done' })
    expect(
      await saveExperienceDraft(
        writer(23),
        form({ editing: 'half-done' }),
        NOW,
      ),
    ).toEqual({ ok: false, reason: 'not-found' })
  })

  it('holds its files as long as it is a draft, and submits them with it', async () => {
    const owner = writer(24)
    const held = await holdFiles(
      owner,
      [
        { slot: 'export', filename: 'mode.json', text: portalExport() },
        { slot: 'added', filename: 'Map.tscn', text: '[gd_scene]' },
      ],
      NOW,
    )
    if (!held.ok) throw new Error('expected the files to be held')
    const [exported, scene] = held.held.map((file) => file.id)
    await saveExperienceDraft(
      owner,
      form({ title: 'With Files', files: [exported, scene] }),
      NOW,
    )
    const { id } = await row('with-files')

    // A week later the draft still has them; nothing else can name them.
    const later = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000)
    expect(
      await heldFilesFor(owner, [exported, scene], { now: later, draft: id }),
    ).toHaveLength(2)
    expect(
      await heldFilesFor(owner, [exported, scene], { now: later }),
    ).toEqual([])

    // Saved without the scene: it is let go.
    await saveExperienceDraft(
      owner,
      form({ editing: 'with-files', title: 'With Files', files: [exported] }),
      later,
    )
    expect(
      (
        await db
          .select({ filename: heldFiles.filename })
          .from(heldFiles)
          .where(eq(heldFiles.experienceId, id))
      ).map((file) => file.filename),
    ).toEqual(['mode.json'])

    // Submitted: the same address, in review, its files kept with it.
    const submitted = await submitExperience(
      owner,
      form({
        editing: 'with-files',
        title: 'With Files',
        isTemplate: 'true',
        teamPlayers: ['16', '16'],
        files: [exported],
      }),
      { ...nobody, now: later },
    )
    expect(submitted).toEqual({ ok: true, slug: 'with-files' })
    expect(await row('with-files')).toMatchObject({
      status: 'pending',
      draftForm: null,
    })
    expect(
      await db
        .select({ kind: projectFiles.kind })
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.experienceId, id),
            eq(projectFiles.kind, 'export'),
          ),
        ),
    ).toHaveLength(1)
    expect(
      await db.select().from(heldFiles).where(eq(heldFiles.experienceId, id)),
    ).toEqual([])

    // In review, saving keeps the form and leaves what was sent, which is
    // what the moderator is looking at.
    const sent = async () =>
      (
        await db
          .select({
            title: experiences.title,
            descriptionMd: experiences.descriptionMd,
            submittedAt: experiences.submittedAt,
            version: experiences.version,
          })
          .from(experiences)
          .where(eq(experiences.id, id))
      )[0]
    const before = await sent()
    expect(
      await saveExperienceDraft(
        owner,
        form({ editing: 'with-files', title: 'Saved Only' }),
        later,
      ),
    ).toEqual({ ok: true, slug: 'with-files' })
    expect(await sent()).toEqual(before)
    expect(await row('with-files')).toMatchObject({
      status: 'pending',
      draftForm: { fields: { title: 'Saved Only' } },
    })

    // Sent again: the new version takes the old one's place in the queue,
    // with the files it had.
    expect(
      await submitExperience(
        owner,
        form({
          editing: 'with-files',
          title: 'With Files',
          description: 'Now with rules.',
          isTemplate: 'true',
          teamPlayers: ['16', '16'],
        }),
        { ...nobody, now: new Date(later.getTime() + 60_000) },
      ),
    ).toEqual({ ok: true, slug: 'with-files' })
    const after = await sent()
    expect(after).toEqual({
      title: 'With Files',
      descriptionMd: 'Now with rules.',
      submittedAt: before.submittedAt,
      version: before.version + 1,
    })
    expect(await row('with-files')).toMatchObject({
      status: 'pending',
      draftForm: null,
    })
    expect(
      await db
        .select({ kind: projectFiles.kind })
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.experienceId, id),
            eq(projectFiles.kind, 'export'),
          ),
        ),
    ).toHaveLength(1)

    // A moderator who opened the version before cannot decide on it.
    expect(
      await decideSubmission(
        moderator,
        id,
        { approve: true, version: before.version },
        later,
      ),
    ).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { form: CHANGED_SINCE_OPENED },
    })
    expect(await row('with-files')).toMatchObject({ status: 'pending' })
    expect(
      await decideSubmission(
        moderator,
        id,
        { approve: true, version: after.version },
        later,
      ),
    ).toMatchObject({ ok: true, status: 'published' })
  })

  it('holds no more with a live one than its saved form and its edit name, however often it is saved', async () => {
    const owner = writer(24)
    const { id } = await row('with-files')
    expect((await row('with-files')).status).toBe('published')
    const hold = async (slot: 'export' | 'added', filename: string) => {
      const held = await holdFiles(
        owner,
        [
          {
            slot,
            filename,
            text: slot === 'export' ? portalExport() : '[gd_scene]',
          },
        ],
        NOW,
      )
      if (!held.ok) throw new Error('expected the file to be held')
      return held.held[0].id
    }
    const withIt = async () =>
      (
        await db
          .select({ id: heldFiles.id })
          .from(heldFiles)
          .where(eq(heldFiles.experienceId, id))
      )
        .map((file) => file.id)
        .sort()
    const save = (files: string[]) =>
      saveExperienceDraft(
        owner,
        form({ editing: 'with-files', title: 'With Files', files }),
        NOW,
      )

    // Saved again and again, each time with a new file: only the last is
    // held with it, and nothing is left loose to count.
    let last = ''
    for (let round = 0; round < 5; round += 1) {
      last = await hold('added', `Round${round}.tscn`)
      expect(await save([last])).toEqual({ ok: true, slug: 'with-files' })
      expect(await withIt()).toEqual([last])
    }

    // Sent as an edit with a new export: what the edit names stays held
    // while a later save names something else.
    const sentExport = await hold('export', 'mode.json')
    expect(
      await submitExperience(
        owner,
        form({
          editing: 'with-files',
          title: 'With Files',
          isTemplate: 'true',
          teamPlayers: ['16', '16'],
          files: [sentExport],
        }),
        { ...nobody, now: NOW },
      ),
    ).toEqual({ ok: true, slug: 'with-files' })
    expect(await withIt()).toEqual([sentExport])
    const savedAfter = await hold('added', 'After.tscn')
    await save([savedAfter])
    expect(await withIt()).toEqual([sentExport, savedAfter].sort())
    const savedAgain = await hold('added', 'Again.tscn')
    await save([savedAgain])
    expect(await withIt()).toEqual([sentExport, savedAgain].sort())
  })

  it('submits a draft and deletes it at once without the two waiting on each other', async () => {
    const owner = writer(32)
    const held = await holdFiles(
      owner,
      [{ slot: 'export', filename: 'mode.json', text: portalExport() }],
      NOW,
    )
    if (!held.ok) throw new Error('expected the file to be held')
    const files = held.held.map((file) => file.id)
    const draft = form({ title: 'Both At Once', files })
    expect(await saveExperienceDraft(owner, draft, NOW)).toEqual({
      ok: true,
      slug: 'both-at-once',
    })
    const { id } = await row('both-at-once')

    // Deleting takes the experience, then its files. The submission starts
    // while the experience is held, and must wait for it before taking the
    // files, or each holds what the other wants.
    let submitting: Promise<unknown> = Promise.resolve()
    await db.transaction(async (tx) => {
      await tx
        .select({ id: experiences.id })
        .from(experiences)
        .where(eq(experiences.id, id))
        .for('update')
      submitting = submitExperience(
        owner,
        {
          ...draft,
          editing: 'both-at-once',
          isTemplate: 'true',
          teamPlayers: ['16', '16'],
        },
        { ...nobody, now: NOW },
      )
      // Until the submission is waiting on a lock.
      for (let tries = 0; tries < 100; tries += 1) {
        const [{ waiting }] =
          await sql`select count(*)::int as waiting from pg_locks where not granted`
        if (waiting > 0) break
        await new Promise((done) => setTimeout(done, 50))
      }
      await tx.delete(heldFiles).where(eq(heldFiles.experienceId, id))
      await tx
        .update(experiences)
        .set({ deletedAt: NOW })
        .where(eq(experiences.id, id))
    })
    // The submission then finds its files gone, and says so.
    expect(await submitting).toMatchObject({ ok: false })
    expect(await row('both-at-once')).toMatchObject({ status: 'draft' })
  })

  it(`keeps up to ${MAX_DRAFTS} drafts an account`, async () => {
    const owner = writer(25)
    for (let n = 0; n < MAX_DRAFTS; n += 1) {
      const saved = await saveExperienceDraft(
        owner,
        form({ title: `Draft number ${n}` }),
        NOW,
      )
      expect(saved.ok).toBe(true)
    }
    expect(
      await saveExperienceDraft(owner, form({ title: 'One too many' }), NOW),
    ).toMatchObject({ ok: false, errors: { form: expect.any(String) } })
    // Deleting one makes room.
    expect(await deleteExperienceDraft(owner, 'draft-number-0', NOW)).toEqual({
      ok: true,
    })
    expect(
      (await saveExperienceDraft(owner, form({ title: 'One more' }), NOW)).ok,
    ).toBe(true)
    // Drafts were sent to nobody, so none counts toward a day's submissions.
    expect(
      await submitExperience(
        owner,
        form({
          title: 'Sent After Drafts',
          isTemplate: 'true',
          filesUrl: 'https://www.dropbox.com/s/abc/files.zip',
          teamPlayers: ['16', '16'],
        }),
        { ...nobody, now: NOW },
      ),
    ).toEqual({ ok: true, slug: 'sent-after-drafts' })
  })

  it('deletes only its owner’s draft', async () => {
    const owner = writer(26)
    await saveExperienceDraft(owner, form({ title: 'Thrown Away' }), NOW)
    expect(await deleteExperienceDraft(null, 'thrown-away', NOW)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    expect(await deleteExperienceDraft(writer(27), 'thrown-away', NOW)).toEqual(
      { ok: false, reason: 'not-found' },
    )
    expect(await deleteExperienceDraft(owner, 'thrown-away', NOW)).toEqual({
      ok: true,
    })
    expect((await row('thrown-away')).deletedAt).not.toBeNull()
    expect(await getExperience('thrown-away', NOW, owner)).toBeNull()

    // Gone, so neither saved nor sent.
    expect(
      await saveExperienceDraft(
        owner,
        form({ editing: 'thrown-away', title: 'Back Again' }),
        NOW,
      ),
    ).toEqual({ ok: false, reason: 'not-found' })
    expect(
      await submitExperience(
        owner,
        form({
          editing: 'thrown-away',
          isTemplate: 'true',
          filesUrl: 'https://www.dropbox.com/s/abc/files.zip',
          teamPlayers: ['16', '16'],
        }),
        { ...nobody, now: NOW },
      ),
    ).toEqual({ ok: false, reason: 'not-found' })
    expect((await row('thrown-away')).status).toBe('draft')
  })

  it('keeps no more than a form holds', async () => {
    const owner = writer(31)
    expect(
      await saveExperienceDraft(
        owner,
        form({ code: 'x'.repeat(1_100_000) }),
        NOW,
      ),
    ).toMatchObject({ ok: false, errors: { code: expect.any(String) } })
    expect(
      await saveExperienceDraft(
        owner,
        form({ tags: Array.from({ length: 31 }, (_, n) => `tag-${n}`) }),
        NOW,
      ),
    ).toMatchObject({ ok: false, errors: { tags: expect.any(String) } })
    expect(
      await saveExperienceDraft(owner, form({ title: ['One', 'Two'] }), NOW),
    ).toMatchObject({ ok: false, errors: { title: expect.any(String) } })
    // A form field it does not know is not kept, so it cannot be used to
    // fill the draft either.
    expect(
      (
        await saveExperienceDraft(
          owner,
          form({ padding: 'x'.repeat(1_100_000) }),
          NOW,
        )
      ).ok,
    ).toBe(true)
    const [kept] = await db
      .select({ draftForm: experiences.draftForm })
      .from(experiences)
      .where(eq(experiences.ownerId, owner.id))
    expect(JSON.stringify(kept.draftForm).length).toBeLessThan(10_000)
  })

  it('opens one sent back as it was submitted, and resubmits it at the same address', async () => {
    const owner = writer(29)
    const held = await holdFiles(
      owner,
      [
        {
          slot: 'export',
          filename: 'mode.json',
          text: portalExport({ maps: ['MP_Abbasid'] }),
        },
      ],
      NOW,
    )
    if (!held.ok) throw new Error('expected the export to be held')
    await submitExperience(
      owner,
      form({
        title: 'Sent Back',
        description: 'The first try.',
        isTemplate: 'true',
        teamPlayers: ['16', '16'],
        tags: ['casual'],
        media: ['https://i.example/a.png'],
        credits: ['Coupe'],
        files: held.held.map((file) => file.id),
      }),
      { ...nobody, now: NOW },
    )
    const { id } = await row('sent-back')
    const decided = await decideSubmission(
      moderator,
      id,
      { approve: false, note: 'Say how a round is won.', version: 1 },
      NOW,
    )
    expect(decided.ok).toBe(true)

    // Listed with Edit, and opened with everything it was submitted with.
    const listed = await listOwnSubmissions(owner)
    expect(
      listed.ok && listed.items.find((item) => item.title === 'Sent Back'),
    ).toMatchObject({
      review: 'Changes requested',
      editHref: '/experiences/sent-back/edit',
    })
    const page = await getDraftEditPage(owner, 'sent-back', {}, nobody)
    if (page.state !== 'ok') throw new Error('expected the edit page')
    expect(page.editing).toMatchObject({
      status: 'changes_requested',
      reviewNote: 'Say how a round is won.',
      submittedFiles: [{ kind: 'export', filename: 'mode.json' }],
    })
    expect(page.draft?.fields).toMatchObject({
      title: 'Sent Back',
      description: 'The first try.',
      isTemplate: 'true',
      teamPlayers: ['16', '16'],
      tags: ['casual'],
      media: ['https://i.example/a.png'],
      credits: ['Coupe'],
    })
    // Not something to delete: it has been seen.
    expect(await deleteExperienceDraft(owner, 'sent-back', NOW)).toEqual({
      ok: false,
      reason: 'not-found',
    })

    // Resubmitted with a better description and no new files: in review
    // again, with the files and maps it had.
    expect(
      await submitExperience(
        owner,
        form({
          ...page.draft?.fields,
          editing: 'sent-back',
          description: 'First to three captures wins the round.',
        }),
        { ...nobody, now: NOW },
      ),
    ).toEqual({ ok: true, slug: 'sent-back' })
    const [after] = await db
      .select({
        status: experiences.status,
        descriptionMd: experiences.descriptionMd,
        mapRotation: experiences.mapRotation,
        reviewNote: experiences.reviewNote,
      })
      .from(experiences)
      .where(eq(experiences.id, id))
    expect(after).toMatchObject({
      status: 'pending',
      descriptionMd: 'First to three captures wins the round.',
      mapRotation: [{ map: 'MP_Abbasid' }],
      // The note was about what was sent before.
      reviewNote: null,
    })
    expect(
      await db
        .select({ kind: projectFiles.kind })
        .from(projectFiles)
        .where(
          and(
            eq(projectFiles.experienceId, id),
            eq(projectFiles.kind, 'export'),
          ),
        ),
    ).toHaveLength(1)
    // In review now, and opened in the form as it was sent, to change and
    // send again.
    const reopened = await getDraftEditPage(owner, 'sent-back', {}, nobody)
    if (reopened.state !== 'ok') throw new Error('expected the edit page')
    expect(reopened.editing).toMatchObject({
      status: 'pending',
      reviewNote: null,
    })
    expect(reopened.draft?.fields.description).toBe(
      'First to three captures wins the round.',
    )
  })

  it('lists its owner’s things, each with where it stands', async () => {
    const owner = writer(28)
    expect((await listOwnSubmissions(null)).ok).toBe(false)
    await saveExperienceDraft(owner, form({ title: 'Listed Draft' }), NOW)
    await submitExperience(
      owner,
      form({
        title: 'Listed Template',
        isTemplate: 'true',
        filesUrl: 'https://www.dropbox.com/s/abc/files.zip',
        teamPlayers: ['16', '16'],
      }),
      { ...nobody, now: NOW },
    )
    const listed = await listOwnSubmissions(owner)
    if (!listed.ok) throw new Error('expected the list')
    const byTitle = (title: string) =>
      listed.items.find((item) => item.title === title)
    expect(byTitle('Listed Draft')).toMatchObject({
      listing: 'Draft',
      request: null,
      review: null,
      editHref: '/experiences/listed-draft/edit',
      happened: { what: 'saved' },
    })
    expect(byTitle('Listed Template')).toMatchObject({
      listing: 'Draft',
      request: 'Submission',
      review: 'In review',
      // Changed and sent again from the form while it waits.
      editHref: '/experiences/listed-template/edit',
      happened: {
        what: 'submitted',
        place: { at: expect.any(Number), of: expect.any(Number) },
      },
    })
    expect(listed.tally).toMatchObject({ drafts: 1, inReview: 1, waiting: 1 })
    // Nobody else's.
    expect(
      listed.items.every((item) =>
        ['Listed Draft', 'Listed Template'].includes(item.title),
      ),
    ).toBe(true)
  })
})
