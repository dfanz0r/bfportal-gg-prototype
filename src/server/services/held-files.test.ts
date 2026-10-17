import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { seed } from '../../../seed/seed'
import { portalExport } from '../../../tests/portal-export'
import { MAX_ADDED_FILES, MAX_EXPORT_BYTES } from '../../shared/project-files'
import type { Actor } from '../auth/actor'
import { db, sql } from '../db'
import { heldFiles } from '../db/schema'
import { addFilesToForm, heldFilesFor, holdFiles } from './held-files'

const NOW = new Date('2026-10-16T12:00:00Z')
const holder = (n: number): Actor => ({
  id: `seed-recruit-${String(n).padStart(2, '0')}`,
  role: 'user',
})
const exportFile = (text = portalExport(), filename = 'mode.json') => ({
  slot: 'export' as const,
  filename,
  text,
})
const added = (filename: string, text = 'scene') => ({
  slot: 'added' as const,
  filename,
  text,
})
const errorsOf = (result: { ok: boolean; errors?: Record<string, string> }) =>
  result.ok ? null : result.errors

describe('holding files for the submit form', () => {
  beforeAll(async () => {
    await seed(db, NOW)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('refuses a visitor who is not signed in', async () => {
    expect(await holdFiles(null, [exportFile()], NOW)).toEqual({
      ok: false,
      reason: 'signed-out',
    })
    expect(await addFilesToForm(null, {}, [exportFile()])).toEqual({
      ok: false,
      reason: 'signed-out',
    })
  })

  it('holds an export with what it holds, and a file beside it', async () => {
    const result = await holdFiles(
      holder(30),
      [exportFile(), added('Map.tscn'), added('notes.json')],
      NOW,
    )
    if (!result.ok) throw new Error('expected the files to be held')
    expect(result.held.map((file) => [file.kind, file.filename])).toEqual([
      ['export', 'mode.json'],
      ['scene', 'Map.tscn'],
      ['other', 'notes.json'],
    ])
    expect(result.held[0].summary).toMatchObject({ name: 'Test Mode' })
    expect(result.held[1].summary).toBeNull()
  })

  it('refuses what is not an export, or not a file the form takes', async () => {
    const errorsFor = async (file: Parameters<typeof holdFiles>[1][number]) =>
      errorsOf(await holdFiles(holder(31), [file], NOW))
    expect(await errorsFor(exportFile('{"name": 1}'))).toEqual({
      exportFile: 'That is not a Portal experience export.',
    })
    expect(await errorsFor(exportFile(portalExport(), 'mode.txt'))).toEqual({
      exportFile: 'Choose the .json file Portal exported.',
    })
    expect(
      await errorsFor({
        ...exportFile(''),
        sizeBytes: MAX_EXPORT_BYTES + 1,
      }),
    ).toEqual({ exportFile: 'An export can be up to 6 MB.' })
    expect(await errorsFor(added('picture.png'))).toEqual({
      addedFiles: 'Only .tscn, .ts, .json files can be added.',
    })
    expect(
      await errorsFor(added('Huge.tscn', 'x'.repeat(2 * 1024 * 1024 + 1))),
    ).toEqual({
      addedFiles: 'Huge.tscn is over 2 MB. Link larger files below.',
    })
    // Nothing refused was held.
    expect(
      await db
        .select()
        .from(heldFiles)
        .where(eq(heldFiles.uploadedBy, holder(31).id)),
    ).toEqual([])
  })

  it('gives each account only its own files, and none held for over a day', async () => {
    const result = await holdFiles(holder(32), [added('Mine.tscn')], NOW)
    if (!result.ok) throw new Error('expected the file to be held')
    const ids = result.held.map((file) => file.id)

    expect(await heldFilesFor(holder(32), ids, { now: NOW })).toHaveLength(1)
    expect(await heldFilesFor(holder(33), ids, { now: NOW })).toEqual([])
    const tomorrow = new Date(NOW.getTime() + 25 * 60 * 60 * 1000)
    expect(await heldFilesFor(holder(32), ids, { now: tomorrow })).toEqual([])
    // Not an id at all: nothing, not an error.
    expect(await heldFilesFor(holder(32), ['nope'], { now: NOW })).toEqual([])
  })

  it('fills in the form from an export, keeping what was typed', async () => {
    const result = await addFilesToForm(
      holder(34),
      { title: 'My own title', description: '', built: ['verified'] },
      [
        exportFile(
          portalExport({
            name: 'From Portal',
            description: 'Said in Portal.',
            script: 'let a = 1',
            teams: [{ players: 8 }, { players: 4, bots: 4 }],
          }),
        ),
      ],
      { fill: true, now: NOW },
    )
    if (!result.ok) throw new Error('expected the export to be read')
    expect(result.fields).toMatchObject({
      title: 'My own title',
      description: 'Said in Portal.',
      teamPlayers: ['8', '4'],
      teamBots: ['0', '4'],
      built: ['script', 'spatial'],
    })
    expect(result.fields.files).toHaveLength(1)
  })

  it('replaces the export, keeps the old one when the new one is refused, and lets go of what the form dropped', async () => {
    const who = holder(35)
    const first = await addFilesToForm(
      who,
      {},
      [exportFile(), added('One.tscn'), added('Two.tscn')],
      { now: NOW },
    )
    if (!first.ok) throw new Error('expected the files to be held')
    const [oldExport, one] = first.fields.files as string[]

    // Not an export: refused, and the form's files are as they were.
    const refused = await addFilesToForm(
      who,
      first.fields,
      [exportFile('{}')],
      { now: NOW },
    )
    expect(errorsOf(refused)).toHaveProperty('exportFile')
    expect(await heldFilesFor(who, [oldExport], { now: NOW })).toHaveLength(1)

    // The form sent without "Two.tscn", and a new export. The title the
    // first export filled in was not typed, so the new one replaces it.
    const second = await addFilesToForm(
      who,
      { files: [oldExport, one], title: 'Test Mode', description: 'Typed.' },
      [exportFile(portalExport({ name: 'Second' }), 'second.json')],
      { fill: true, now: NOW },
    )
    if (!second.ok) throw new Error('expected the export to be read')
    expect(second.fields).toMatchObject({
      title: 'Second',
      description: 'Typed.',
    })
    const kept = await db
      .select({ filename: heldFiles.filename })
      .from(heldFiles)
      .where(eq(heldFiles.uploadedBy, who.id))
    expect(kept.map((file) => file.filename).sort()).toEqual([
      'One.tscn',
      'second.json',
    ])
  })

  it(`takes up to ${MAX_ADDED_FILES} files beside the export`, async () => {
    const who = holder(36)
    const full = await addFilesToForm(
      who,
      {},
      Array.from({ length: MAX_ADDED_FILES }, (_, n) => added(`${n}.tscn`)),
      { now: NOW },
    )
    if (!full.ok) throw new Error('expected the files to be held')
    expect(
      errorsOf(
        await addFilesToForm(who, full.fields, [added('more.tscn')], {
          now: NOW,
        }),
      ),
    ).toEqual({
      addedFiles: `Add up to ${MAX_ADDED_FILES} files beside the export.`,
    })
    // An export still fits beside them.
    expect(
      (await addFilesToForm(who, full.fields, [exportFile()], { now: NOW })).ok,
    ).toBe(true)
  })
})
