import { and, eq, isNull } from 'drizzle-orm'

import type { FileKind } from '../../shared/content'
import { formatBytes } from '../../shared/dates'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experiences, heldFiles, projectFiles, revisions } from '../db/schema'
import { needsStaff } from './access'
import { editPayloadSchema } from './edit-payload'
import { fileReadableBy } from './experience'
import { heldIdsIn } from './held-files'

// One project file, to read on a page rather than download: for a moderator
// reviewing a submission's files, and for anyone looking at a template's.
// The text is only ever shown escaped, as text.

/** The most of a file a page shows. A longer one is cut, and says so. */
export const MAX_SHOWN_LINES = 5000
const MAX_SHOWN_CHARS = 1_000_000

/** A string this long and made of base64 is data, not something to read. */
const LONG_BASE64 = /^[A-Za-z0-9+/=\r\n]{200,}$/

/**
 * A file's text as it is easier to read: JSON indented, with long base64 in
 * it, such as the attachments inside an export, replaced by a note of its
 * size. Anything else as it is.
 */
function readable(filename: string, body: string) {
  if (!filename.toLowerCase().endsWith('.json')) {
    return { text: body, reformatted: false }
  }
  try {
    const json = JSON.parse(body, (_, value) =>
      typeof value === 'string' && LONG_BASE64.test(value)
        ? `[base64, ${formatBytes(Math.floor((value.length * 3) / 4))}]`
        : value,
    )
    const text = JSON.stringify(json, null, 2)
    return { text, reformatted: text !== body }
  } catch {
    // Not JSON after all: as it is.
    return { text: body, reformatted: false }
  }
}

/**
 * A project file to view, if whoever is looking may read it: the same rule
 * as downloading it. Null otherwise.
 */
export async function getFileView(publicId: string, viewer: Actor | null) {
  const [found] = await db
    .select({
      file: {
        // The one its addresses use.
        id: projectFiles.publicId,
        kind: projectFiles.kind,
        filename: projectFiles.filename,
        sizeBytes: projectFiles.sizeBytes,
        fromExport: projectFiles.fromExport,
      },
      body: projectFiles.body,
      experience: {
        slug: experiences.slug,
        title: experiences.title,
        isTemplate: experiences.isTemplate,
      },
    })
    .from(projectFiles)
    .innerJoin(experiences, eq(experiences.id, projectFiles.experienceId))
    .where(and(eq(projectFiles.publicId, publicId), fileReadableBy(viewer)))
    .limit(1)
  return found ? viewOf(found, `/api/files/${found.file.id}`) : null
}

/**
 * A file an edit waiting for review would store in place of the live one's,
 * for a moderator to read before deciding. Only staff, only while the edit
 * waits, and only a file it names. Null otherwise.
 */
export async function getProposedFile(
  viewer: Actor | null,
  editId: number,
  fileId: string,
) {
  if (needsStaff(viewer) || heldIdsIn([fileId]).length === 0) return null
  const [edit] = await db
    .select({
      experienceId: revisions.experienceId,
      payload: revisions.payload,
    })
    .from(revisions)
    .where(
      and(
        eq(revisions.id, editId),
        eq(revisions.kind, 'edit'),
        eq(revisions.status, 'pending'),
      ),
    )
  const named = editPayloadSchema.catch({}).parse(edit?.payload).form?.files
  if (!edit?.experienceId || !named?.includes(fileId)) return null
  const [found] = await db
    .select({
      file: {
        id: heldFiles.id,
        kind: heldFiles.kind,
        filename: heldFiles.filename,
        sizeBytes: heldFiles.sizeBytes,
      },
      body: heldFiles.body,
      experience: {
        slug: experiences.slug,
        title: experiences.title,
        isTemplate: experiences.isTemplate,
      },
    })
    .from(heldFiles)
    .innerJoin(experiences, eq(experiences.id, heldFiles.experienceId))
    .where(
      and(
        eq(heldFiles.id, fileId),
        eq(heldFiles.experienceId, edit.experienceId),
        isNull(experiences.deletedAt),
      ),
    )
  return found ? { ...found, file: { ...found.file, fromExport: false } } : null
}

/** The same, to read on a page. */
export async function getProposedFileView(
  viewer: Actor | null,
  editId: number,
  fileId: string,
) {
  const found = await getProposedFile(viewer, editId, fileId)
  return found ? viewOf(found, `/api/edits/${editId}/files/${fileId}`) : null
}

/** A file as a page shows it, cut where it is too long to show. */
function viewOf(
  found: {
    file: {
      id: string
      kind: FileKind
      filename: string
      sizeBytes: number
      fromExport: boolean
    }
    body: string
    experience: { slug: string; title: string; isTemplate: boolean }
  },
  download: string,
) {
  const { text, reformatted } = readable(found.file.filename, found.body)
  // A file ends with a line break, which is not a line.
  const lines = text.replace(/\n$/, '').split('\n')
  let shown = lines.slice(0, MAX_SHOWN_LINES).join('\n')
  let truncated = lines.length > MAX_SHOWN_LINES
  if (shown.length > MAX_SHOWN_CHARS) {
    truncated = true
    // Whole lines where there is a break to cut at; a line longer than all
    // of it, such as minified data, is cut where the room runs out.
    const lastBreak = shown.lastIndexOf('\n', MAX_SHOWN_CHARS)
    shown = shown.slice(0, lastBreak > 0 ? lastBreak : MAX_SHOWN_CHARS)
  }
  const shownLines = shown.split('\n').length
  return {
    file: found.file,
    experience: found.experience,
    /** Where the file as it was uploaded is downloaded. */
    download,
    text: shown,
    lines: lines.length,
    shownLines,
    // Said, not worked out from the counts: one long line cut short is
    // still one line.
    truncated,
    reformatted,
  }
}
