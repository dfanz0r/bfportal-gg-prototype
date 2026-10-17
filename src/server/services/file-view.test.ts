import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { experiences, projectFiles } from '../db/schema'
import { getFileView, MAX_SHOWN_LINES } from './file-view'

const NOW = new Date('2026-10-17T12:00:00Z')
const moderator: Actor = { id: 'seed-kestrel', role: 'moderator' }

/** A file kept with a live experience that is not a template. */
async function privateFile(filename: string, body: string) {
  const [row] = await db
    .select({ id: experiences.id, ownerId: experiences.ownerId })
    .from(experiences)
    .where(
      and(
        eq(experiences.status, 'published'),
        eq(experiences.isTemplate, false),
      ),
    )
    .limit(1)
  const [file] = await db
    .insert(projectFiles)
    .values({
      experienceId: row.id,
      kind: 'other',
      filename,
      sizeBytes: Buffer.byteLength(body),
      sha256: 'x',
      body,
      uploadedBy: row.ownerId,
    })
    .returning({ id: projectFiles.publicId })
  return { id: file.id, owner: { id: row.ownerId, role: 'user' as const } }
}

describe('viewing a project file', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('shows a template’s file to anyone, as it is', async () => {
    const [file] = await db
      .select({ id: projectFiles.publicId })
      .from(projectFiles)
      .where(eq(projectFiles.filename, 'Script.ts'))
    const view = await getFileView(file.id, null)
    expect(view).toMatchObject({
      file: { filename: 'Script.ts', kind: 'script' },
      reformatted: false,
    })
    expect(view?.text).toContain('RETURN_AFTER_SECONDS')
  })

  it('shows a private file only to its owner and the moderators', async () => {
    const { id, owner } = await privateFile('notes.json', '{"a":1}')
    expect(await getFileView(id, null)).toBeNull()
    expect(
      await getFileView(id, { id: 'seed-recruit-05', role: 'user' }),
    ).toBeNull()
    expect(await getFileView(id, owner)).not.toBeNull()
    expect(await getFileView(id, moderator)).not.toBeNull()
  })

  it('indents JSON, and shows long base64 in it as its size', async () => {
    const data = Buffer.alloc(3000, 7).toString('base64')
    const { id } = await privateFile(
      'mode.json',
      JSON.stringify({ name: 'Mode', attachment: { original: data } }),
    )
    const view = await getFileView(id, moderator)
    expect(view?.reformatted).toBe(true)
    expect(view?.text).toBe(
      [
        '{',
        '  "name": "Mode",',
        '  "attachment": {',
        '    "original": "[base64, 3 KB]"',
        '  }',
        '}',
      ].join('\n'),
    )
  })

  it(`shows the first ${MAX_SHOWN_LINES} lines of a longer file`, async () => {
    const body = Array.from(
      { length: MAX_SHOWN_LINES + 10 },
      (_, n) => `line ${n}`,
    ).join('\n')
    const { id } = await privateFile('long.ts', body)
    const view = await getFileView(id, moderator)
    expect(view).toMatchObject({
      lines: MAX_SHOWN_LINES + 10,
      shownLines: MAX_SHOWN_LINES,
    })
  })
})
