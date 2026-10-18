import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { CHANGED_SINCE_OPENED } from '../../shared/decision'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { revisions, snippets } from '../db/schema'
import {
  decideEdit,
  decideSnippet,
  getEditReview,
  listQueue,
} from './moderation'
import { listOwnSubmissions } from './own-submissions'
import { getSnippetEditPage, submitSnippet } from './snippet-submissions'
import { getSnippet } from './snippets'

const NOW = new Date('2026-10-18T12:00:00Z')
const owner: Actor = { id: 'seed-recruit-31', role: 'user' }
const moderator: Actor = { id: 'seed-kestrel', role: 'moderator' }

const form = (changes: Record<string, unknown> = {}) => ({
  title: 'Round timer',
  description: 'Counts each round down.',
  script: 'let seconds = 300\n',
  category: 'rules',
  ...changes,
})

const row = async (slug: string) =>
  (
    await db
      .select({
        id: snippets.id,
        status: snippets.status,
        title: snippets.title,
        script: snippets.script,
        version: snippets.version,
        submittedAt: snippets.submittedAt,
        reviewNote: snippets.reviewNote,
      })
      .from(snippets)
      .where(eq(snippets.slug, slug))
  )[0]

const pending = (id: number) =>
  db
    .select({ id: revisions.id, version: revisions.version })
    .from(revisions)
    .where(and(eq(revisions.snippetId, id), eq(revisions.status, 'pending')))

describe('changing a snippet after it was sent', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('is for its owner alone', async () => {
    const sent = await submitSnippet(owner, form(), { now: NOW })
    if (!sent.ok) throw new Error('expected the snippet to be sent')
    const changed = form({ editing: sent.slug, title: 'Not theirs' })
    expect(await submitSnippet(null, changed, { now: NOW })).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    for (const actor of [moderator, { id: 'seed-vantage', role: 'user' }]) {
      expect(
        await submitSnippet(actor as Actor, changed, { now: NOW }),
      ).toEqual({ ok: false, reason: 'not-found' })
      expect(
        (await getSnippetEditPage(actor as Actor, sent.slug, {})).state,
      ).toBe('not-found')
    }
  })

  it('sends one in review again in its place, and refuses a decision on what came before', async () => {
    const { id, version, submittedAt } = await row('round-timer')
    const page = await getSnippetEditPage(owner, 'round-timer', {})
    if (page.state !== 'ok') throw new Error('expected the form')
    expect(page.editing).toMatchObject({ status: 'pending' })
    expect(page.draft.fields).toMatchObject({
      title: 'Round timer',
      editing: 'round-timer',
    })

    const later = new Date(NOW.getTime() + 60_000)
    expect(
      await submitSnippet(
        owner,
        form({ editing: 'round-timer', script: 'let seconds = 240\n' }),
        { now: later },
      ),
    ).toEqual({ ok: true, slug: 'round-timer' })
    expect(await row('round-timer')).toMatchObject({
      status: 'pending',
      script: 'let seconds = 240\n',
      version: version + 1,
      submittedAt,
    })

    expect(
      await decideSnippet(moderator, id, { approve: true, version }, later),
    ).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { form: CHANGED_SINCE_OPENED },
    })
    expect(
      await decideSnippet(
        moderator,
        id,
        { approve: false, note: 'Say what it counts.', version: version + 1 },
        later,
      ),
    ).toMatchObject({ ok: true, status: 'changes_requested' })
  })

  it('opens one sent back with its note, and resubmits it', async () => {
    const page = await getSnippetEditPage(owner, 'round-timer', {})
    if (page.state !== 'ok') throw new Error('expected the form')
    expect(page.editing).toMatchObject({
      status: 'changes_requested',
      reviewNote: 'Say what it counts.',
    })
    const listed = await listOwnSubmissions(owner)
    expect(
      listed.ok && listed.items.find((item) => item.title === 'Round timer'),
    ).toMatchObject({ editHref: '/snippets/round-timer/edit' })

    expect(
      await submitSnippet(
        owner,
        form({
          editing: 'round-timer',
          description: 'Counts each round down from five minutes.',
          script: 'let seconds = 240\n',
        }),
        { now: NOW },
      ),
    ).toEqual({ ok: true, slug: 'round-timer' })
    const sent = await row('round-timer')
    expect(sent).toMatchObject({ status: 'pending', reviewNote: null })
    expect(
      await decideSnippet(
        moderator,
        sent.id,
        { approve: true, version: sent.version },
        NOW,
      ),
    ).toMatchObject({ ok: true, status: 'published' })
  })

  it('waits beside the live page as one edit, which sending again replaces', async () => {
    const before = await row('round-timer')
    expect(
      await submitSnippet(
        owner,
        form({ editing: 'round-timer', title: 'Round countdown' }),
        { now: NOW },
      ),
    ).toEqual({ ok: true, slug: 'round-timer' })
    // The page is as it was. Its owner is told the changes wait.
    expect(await row('round-timer')).toEqual(before)
    expect(
      (await getSnippet('round-timer', NOW, owner))?.viewer.editWaiting,
    ).toBe(true)
    const [first] = await pending(before.id)

    // The form opens on what was sent, and sending again adds to it.
    const page = await getSnippetEditPage(owner, 'round-timer', {})
    if (page.state !== 'ok') throw new Error('expected the form')
    expect(page.draft.fields.title).toBe('Round countdown')
    await submitSnippet(
      owner,
      form({
        editing: 'round-timer',
        title: 'Round countdown',
        description: 'Counts each round down from five minutes.',
        script: 'let seconds = 180\n',
      }),
      { now: NOW },
    )
    expect(await pending(before.id)).toEqual([{ id: first.id, version: 2 }])

    const queue = await listQueue(moderator)
    if (!queue.ok) throw new Error('expected the queue')
    expect(queue.edits.find((item) => item.id === first.id)).toMatchObject({
      kind: 'snippet',
      changes: ['Changes to its page'],
    })
    const review = await getEditReview(moderator, first.id)
    if (!review.ok) throw new Error('expected the review')
    expect(review.edit.subject).toMatchObject({
      kind: 'snippet',
      href: '/snippets/round-timer',
    })
    expect(
      review.edit.changes.map((change) => [change.field, change.proposed]),
    ).toEqual([
      ['Title', 'Round countdown'],
      ['Snippet', 'let seconds = 180\n'],
    ])

    // A moderator who opened the first version cannot approve it.
    expect(
      await decideEdit(moderator, first.id, { approve: true, version: 1 }, NOW),
    ).toMatchObject({ ok: false, errors: { form: CHANGED_SINCE_OPENED } })
    expect((await row('round-timer')).title).toBe('Round timer')

    expect(
      await decideEdit(moderator, first.id, { approve: true, version: 2 }, NOW),
    ).toEqual({ ok: true, slug: 'round-timer', status: 'approved' })
    expect(await row('round-timer')).toMatchObject({
      status: 'published',
      title: 'Round countdown',
      script: 'let seconds = 180\n',
    })
    expect(
      (await getSnippet('round-timer', NOW, owner))?.viewer.editWaiting,
    ).toBe(false)
  })

  it('opens a live edit sent back with its note', async () => {
    const { id } = await row('round-timer')
    await submitSnippet(
      owner,
      form({ editing: 'round-timer', title: 'Timer' }),
      { now: NOW },
    )
    const [edit] = await pending(id)
    await decideEdit(
      moderator,
      edit.id,
      { approve: false, note: 'Keep the longer name.', version: edit.version },
      NOW,
    )
    const page = await getSnippetEditPage(owner, 'round-timer', {})
    if (page.state !== 'ok') throw new Error('expected the form')
    expect(page.editing).toMatchObject({
      status: 'published',
      reviewNote: 'Keep the longer name.',
      editWaiting: false,
    })
    expect(page.draft.fields.title).toBe('Timer')
  })
})
