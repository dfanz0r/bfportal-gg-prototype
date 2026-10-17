import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { portalExport } from '../../../tests/portal-export'
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
    // It is not a draft any more, to save or to submit as one.
    expect(
      await submitExperience(
        owner,
        form({ editing: 'with-files', teamPlayers: ['16', '16'] }),
        { ...nobody, now: later },
      ),
    ).toEqual({ ok: false, reason: 'not-found' })
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
      editHref: null,
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
