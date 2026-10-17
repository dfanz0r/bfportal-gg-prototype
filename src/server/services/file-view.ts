import { and, eq } from 'drizzle-orm'

import { formatBytes } from '../../shared/dates'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { experiences, projectFiles } from '../db/schema'
import { fileReadableBy } from './experience'

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
  if (!found) return null

  const { text, reformatted } = readable(found.file.filename, found.body)
  // A file ends with a line break, which is not a line.
  const lines = text.replace(/\n$/, '').split('\n')
  let shown = lines.slice(0, MAX_SHOWN_LINES).join('\n')
  if (shown.length > MAX_SHOWN_CHARS) {
    // Whole lines only.
    shown = shown.slice(0, shown.lastIndexOf('\n', MAX_SHOWN_CHARS))
  }
  const shownLines = shown.split('\n').length
  return {
    file: found.file,
    experience: found.experience,
    text: shown,
    lines: lines.length,
    shownLines,
    reformatted,
  }
}
