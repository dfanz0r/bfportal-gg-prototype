import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { MAX_SNIPPET_CHARS, MAX_SNIPPET_LINES } from '../../shared/snippet-form'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { sdkVersions, snippets, submissionDrafts } from '../db/schema'
import { keepDraft, readDraft } from './drafts'
import { submitExperience } from './experience-submissions'
import {
  getSnippetOptions,
  SNIPPET_FIELDS,
  submitSnippet,
} from './snippet-submissions'
import { getSnippet } from './snippets'
import { MAX_WAITING } from './submission-limits'

const NOW = new Date('2026-10-13T12:00:00Z')
// Each test sends as its own account, so none runs into the limit on how many
// one account may have waiting.
const recruit = (n: number): Actor => ({
  id: `seed-recruit-${String(n).padStart(2, '0')}`,
  role: 'user',
})

const SCRIPT = `// Outlines whoever is carrying a flag.
import { mod } from 'portal'

mod.OnPlayerPickedUpFlag((player) => {
  mod.SetOutline(player)
})
`

const form = (changes: Record<string, unknown> = {}) => ({
  title: 'Flag carrier outline',
  description: 'Outlines whoever is carrying a **flag**.',
  script: SCRIPT,
  category: 'interface',
  ...changes,
})

const stored = async (slug: string) => {
  const [row] = await db.select().from(snippets).where(eq(snippets.slug, slug))
  return row
}

const errorsOf = async (changes: Record<string, unknown>) => {
  const result = await submitSnippet(recruit(9), form(changes), { now: NOW })
  return result.ok ? {} : (result.errors ?? {})
}

describe('submitting a snippet', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('refuses a visitor who is not signed in', async () => {
    expect(await submitSnippet(null, form())).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    expect(await stored('flag-carrier-outline')).toBeUndefined()
  })

  it('holds it for a moderator, listed for the current SDK release', async () => {
    const owner = recruit(1)
    expect(await submitSnippet(owner, form(), { now: NOW })).toEqual({
      ok: true,
      slug: 'flag-carrier-outline',
    })

    const row = await stored('flag-carrier-outline')
    expect(row).toMatchObject({
      status: 'pending',
      ownerId: owner.id,
      title: 'Flag carrier outline',
      script: SCRIPT,
      // Its script alone: nothing new is made from a Portal export.
      expJson: null,
      submittedAt: NOW,
      firstPublishedAt: null,
      reviewedBy: null,
    })
    // The description is Markdown, and its HTML is written the one way.
    expect(row.descriptionHtml).toContain('<strong>flag</strong>')
    // Not asked for: the release is the game's newest.
    const [release] = await db
      .select({ version: sdkVersions.version })
      .from(sdkVersions)
      .where(eq(sdkVersions.id, row.sdkVersionId ?? 0))
    expect(release?.version).toBe('1.4.3.0')

    // Nobody but its owner and the moderators can open it yet.
    expect(await getSnippet('flag-carrier-outline', NOW)).toBeNull()
    expect(await getSnippet('flag-carrier-outline', NOW, recruit(2))).toBeNull()
    expect(await getSnippet('flag-carrier-outline', NOW, owner)).toMatchObject({
      status: 'pending',
      viewer: { isOwner: true },
    })
    expect(
      await getSnippet('flag-carrier-outline', NOW, {
        id: 'seed-kestrel',
        role: 'moderator',
      }),
    ).toMatchObject({ status: 'pending', viewer: { isStaff: true } })
  })

  it('says what is wrong, by field', async () => {
    expect(await errorsOf({ title: 'x' })).toHaveProperty('title')
    expect(await errorsOf({ script: '   \n' })).toHaveProperty('script')
    expect(await errorsOf({ category: 'no-such' })).toHaveProperty('category')
    // An experience's category is not a snippet's.
    expect(await errorsOf({ category: 'multiplayer' })).toHaveProperty(
      'category',
    )
  })

  it('takes a snippet, not a whole experience', async () => {
    const lines = (n: number) =>
      Array.from({ length: n }, (_, i) => `const line${i} = ${i}`).join('\n')

    expect(
      await errorsOf({ script: lines(MAX_SNIPPET_LINES + 1) }),
    ).toHaveProperty('script')
    // Right at the limit is fine, and so is a file saved on Windows: its
    // line endings are not extra lines, and are not kept.
    const result = await submitSnippet(
      recruit(3),
      form({
        title: 'Right at the limit',
        script: lines(MAX_SNIPPET_LINES).replace(/\n/g, '\r\n'),
      }),
      { now: NOW },
    )
    expect(result).toMatchObject({ ok: true })
    expect((await stored('right-at-the-limit')).script).not.toContain('\r')
  })

  it('gives each of two with the same title its own address', async () => {
    const results = await Promise.all(
      [4, 5, 6].map((n) =>
        submitSnippet(recruit(n), form({ title: 'Same name' }), { now: NOW }),
      ),
    )
    expect(
      results.map((result) => (result.ok ? result.slug : 'refused')).sort(),
    ).toEqual(['same-name', 'same-name-2', 'same-name-3'])
  })

  it('counts against the same limit as experiences', async () => {
    const sender = recruit(7)
    // One short of the limit, as experiences.
    for (let n = 1; n < MAX_WAITING; n += 1) {
      const result = await submitExperience(
        sender,
        {
          game: 'bf6',
          code: '1abc2',
          category: 'multiplayer',
          title: `Waiting ${n}`,
          teamPlayers: ['8'],
        },
        { lookup: async () => ({ status: 'unavailable' }), now: NOW },
      )
      expect(result).toMatchObject({ ok: true })
    }
    // The last place can be a snippet, and then there is no room for either.
    expect(
      await submitSnippet(sender, form({ title: 'Last place' }), { now: NOW }),
    ).toMatchObject({ ok: true })
    expect(
      await submitSnippet(sender, form({ title: 'One too many' }), {
        now: NOW,
      }),
    ).toMatchObject({
      ok: false,
      reason: 'invalid',
      errors: { form: expect.any(String) },
    })
  })

  it('holds to the limit when two are sent at once', async () => {
    const sender = recruit(20)
    const experience = (title: string) =>
      submitExperience(
        sender,
        {
          game: 'bf6',
          code: '1abc2',
          category: 'multiplayer',
          title,
          teamPlayers: ['8'],
        },
        { lookup: async () => ({ status: 'unavailable' }), now: NOW },
      )
    for (let n = 1; n < MAX_WAITING; n += 1) {
      expect(await experience(`Queued ${n}`)).toMatchObject({ ok: true })
    }
    // One place left, and an experience and a snippet sent for it together.
    const results = await Promise.all([
      experience('Racing for the last place'),
      submitSnippet(sender, form({ title: 'Racing too' }), { now: NOW }),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.find((result) => !result.ok)).toMatchObject({
      reason: 'invalid',
      errors: { form: expect.stringContaining('waiting for a moderator') },
    })
  })

  it('keeps every other field of a refused form, a snippet at its largest too', async () => {
    const sender = recruit(21)
    const script =
      `${'x'.repeat(MAX_SNIPPET_CHARS / MAX_SNIPPET_LINES - 1)}\n`.repeat(
        MAX_SNIPPET_LINES,
      )
    expect(script.length).toBe(MAX_SNIPPET_CHARS)
    const sent = form({
      title: 'x',
      description: 'y'.repeat(10_000),
      script,
    })
    const result = await submitSnippet(sender, sent, { now: NOW })
    expect(result).toMatchObject({
      ok: false,
      errors: { title: expect.any(String) },
    })
    if (result.ok) return
    await keepDraft(
      sender,
      'snippet',
      sent,
      result.errors ?? {},
      SNIPPET_FIELDS,
    )
    expect(await readDraft(sender, 'snippet')).toEqual({
      fields: { ...sent },
      errors: result.errors,
    })
    await db.delete(submissionDrafts)
  })

  it('offers the script categories and says which release it is for', async () => {
    const options = await getSnippetOptions()
    expect(options.categories.map((item) => item.name)).toEqual([
      'Rules',
      'AI',
      'Interface',
      'Admin tools',
    ])
    expect(options.currentSdk).toEqual({ version: '1.4.3.0' })
  })
})
