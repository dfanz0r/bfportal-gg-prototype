import { createHash } from 'node:crypto'
import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'

import type { FileKind } from '../../shared/content'
import {
  ADDED_FILE_TYPES,
  MAX_ADDED_FILES,
  MAX_EXPORT_BYTES,
  MAX_FILE_BYTES,
} from '../../shared/project-files'
import { type Refusal, refuse } from '../../shared/results'
import type { Actor } from '../auth/actor'
import { db } from '../db'
import { heldFiles } from '../db/schema'
import { readExport } from './portal-export'
import type { Executor } from './shared'

// Files chosen on the submit form, held for whoever chose them until the form
// is submitted. See `heldFiles` in the schema.

/** How long a file is held for a form that is not sent. */
const HELD_FOR = 24 * 60 * 60 * 1000
/**
 * The most one account holds at once: the export, every file the form takes
 * beside it, and an export about to replace the first. Each costs space here,
 * so it is counted, under a lock on the account, in the same transaction as
 * the write.
 */
const MAX_HELD = MAX_ADDED_FILES + 2

const MB = 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A file as it was sent: chosen in the export's slot or as a file added
 * beside it, from a form's file input or read by the page's script.
 */
export type SentFile = {
  slot: 'export' | 'added'
  filename: string
  text: string
  /** Its size where it was too large to read: `text` is then empty. */
  sizeBytes?: number
}

const listed = {
  id: heldFiles.id,
  kind: heldFiles.kind,
  filename: heldFiles.filename,
  sizeBytes: heldFiles.sizeBytes,
  summary: heldFiles.summary,
}

/** Not saved with any draft. */
const loose = isNull(heldFiles.experienceId)

/**
 * Held for the form: a loose file chosen in the last day, or one saved with
 * the draft the form is, which is held for as long as the draft is. A file
 * saved with another draft is that draft's.
 */
const heldForForm = (now: Date, draft: number | null) =>
  or(
    and(loose, gt(heldFiles.createdAt, new Date(now.getTime() - HELD_FOR))),
    draft === null ? undefined : eq(heldFiles.experienceId, draft),
  )

/** What a file added beside the export is, by its name, or null if none. */
function addedKind(filename: string): FileKind | null {
  const name = filename.toLowerCase()
  if (!ADDED_FILE_TYPES.some((type) => name.endsWith(type))) return null
  if (name.endsWith('.tscn')) return 'scene'
  if (name.endsWith('.ts')) return 'script'
  if (name.endsWith('.spatial.json')) return 'spatial'
  if (name.endsWith('.strings.json')) return 'strings'
  return 'other'
}

/** The ids in a form's `files`, as many as it sent, that could be held. */
export function heldIdsIn(value: unknown) {
  return [value ?? []]
    .flat()
    .filter((id): id is string => typeof id === 'string' && UUID.test(id))
}

/**
 * The files held for whoever is acting, of those asked for, oldest first.
 * `draft` is the draft the form is, whose saved files it may name.
 */
export async function heldFilesFor(
  actor: Actor,
  ids: string[],
  options: { now?: Date; draft?: number | null; executor?: Executor } = {},
) {
  const wanted = heldIdsIn(ids)
  if (wanted.length === 0) return []
  return (options.executor ?? db)
    .select(listed)
    .from(heldFiles)
    .where(
      and(
        eq(heldFiles.uploadedBy, actor.id),
        inArray(heldFiles.id, wanted),
        heldForForm(options.now ?? new Date(), options.draft ?? null),
      ),
    )
    .orderBy(asc(heldFiles.createdAt))
}

/** The same, with what each file says, to store. */
export async function takeHeldFiles(
  executor: Executor,
  actor: Actor,
  ids: string[],
  options: { now?: Date; draft?: number | null } = {},
) {
  const wanted = heldIdsIn(ids)
  if (wanted.length === 0) return []
  return executor
    .select({ ...listed, sha256: heldFiles.sha256, body: heldFiles.body })
    .from(heldFiles)
    .where(
      and(
        eq(heldFiles.uploadedBy, actor.id),
        inArray(heldFiles.id, wanted),
        heldForForm(options.now ?? new Date(), options.draft ?? null),
      ),
    )
    .orderBy(asc(heldFiles.createdAt))
}

/**
 * Saves the form's files with its draft: those it names are held with it
 * from now on, and any the draft had that the form no longer names are let
 * go.
 */
export async function keepFilesWithDraft(
  executor: Executor,
  actor: Actor,
  draft: number,
  ids: string[],
  now = new Date(),
) {
  const wanted = (await heldFilesFor(actor, ids, { now, draft, executor })).map(
    (file) => file.id,
  )
  await executor
    .delete(heldFiles)
    .where(
      and(
        eq(heldFiles.experienceId, draft),
        wanted.length > 0 ? notInArray(heldFiles.id, wanted) : undefined,
      ),
    )
  if (wanted.length > 0) {
    await executor
      .update(heldFiles)
      .set({ experienceId: draft })
      .where(inArray(heldFiles.id, wanted))
  }
}

/** Lets go of every file a draft was saved with. */
export async function letGoOfDraftFiles(executor: Executor, draft: number) {
  await executor.delete(heldFiles).where(eq(heldFiles.experienceId, draft))
}

/**
 * Lets go of every loose file held for someone, but those in `keep`. Files
 * saved with a draft are the draft's, and stay.
 */
export async function letGoOfHeldFiles(
  executor: Executor,
  actor: Actor,
  keep: string[] = [],
) {
  await executor
    .delete(heldFiles)
    .where(
      and(
        eq(heldFiles.uploadedBy, actor.id),
        loose,
        keep.length > 0 ? notInArray(heldFiles.id, keep) : undefined,
      ),
    )
}

/**
 * Holds the files sent with a form for whoever is acting, once each is
 * checked: an export must read as one, and anything else must be a file the
 * form takes. A file that is not is refused, under the slot it was sent in.
 */
export async function holdFiles(
  actor: Actor | null,
  sent: SentFile[],
  now = new Date(),
): Promise<
  { ok: true; held: Awaited<ReturnType<typeof heldFilesFor>> } | Refusal
> {
  if (!actor) return refuse('signed-out')
  const errors: Record<string, string> = {}
  const ready = sent.flatMap((file): (typeof heldFiles.$inferInsert)[] => {
    const filename = file.filename.trim().slice(-200)
    const sizeBytes = file.sizeBytes ?? Buffer.byteLength(file.text)
    const row = {
      uploadedBy: actor.id,
      filename,
      sizeBytes,
      sha256: createHash('sha256').update(file.text).digest('hex'),
      body: file.text,
    }
    if (file.slot === 'export') {
      if (!filename.toLowerCase().endsWith('.json')) {
        errors.exportFile = 'Choose the .json file Portal exported.'
      } else if (sizeBytes > MAX_EXPORT_BYTES) {
        errors.exportFile = `An export can be up to ${MAX_EXPORT_BYTES / MB} MB.`
      } else {
        const read = readExport(file.text)
        if (read) {
          return [{ ...row, kind: 'export' as const, summary: read.summary }]
        }
        errors.exportFile = 'That is not a Portal experience export.'
      }
      return []
    }
    const kind = addedKind(filename)
    if (!kind) {
      errors.addedFiles = `Only ${ADDED_FILE_TYPES.join(', ')} files can be added.`
    } else if (sizeBytes > MAX_FILE_BYTES) {
      errors.addedFiles = `${filename} is over ${MAX_FILE_BYTES / MB} MB. Link larger files below.`
    } else {
      return [{ ...row, kind, summary: null }]
    }
    return []
  })
  if (Object.keys(errors).length > 0) return refuse('invalid', errors)
  if (ready.length === 0) return { ok: true, held: [] }

  return db.transaction(async (tx) => {
    // Two sent at once from one account wait here, one for the other.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`held:${actor.id}`}, 0))`,
    )
    await tx
      .delete(heldFiles)
      .where(
        and(
          eq(heldFiles.uploadedBy, actor.id),
          loose,
          lt(heldFiles.createdAt, new Date(now.getTime() - HELD_FOR)),
        ),
      )
    // A draft's files are counted with the drafts, not here.
    const [{ value: holding }] = await tx
      .select({ value: count() })
      .from(heldFiles)
      .where(and(eq(heldFiles.uploadedBy, actor.id), loose))
    if (holding + ready.length > MAX_HELD) {
      return refuse('invalid', {
        addedFiles: `Up to ${MAX_ADDED_FILES} files and one export. Remove one first.`,
      })
    }
    const held = await tx
      .insert(heldFiles)
      .values(ready.map((row) => ({ ...row, createdAt: now })))
      .returning(listed)
    return { ok: true as const, held }
  })
}

/**
 * The form with the files sent with it added to those it holds. A new export
 * takes the place of the one it had. Every other file held for its sender is
 * let go, since the form no longer has it.
 *
 * With `fill`, the form is filled in from a new export as well: its name and
 * description where those are empty or still what the export before it
 * said, and its teams and what it is built with, which the export knows
 * better than the form.
 */
export async function addFilesToForm(
  actor: Actor | null,
  fields: Record<string, unknown>,
  sent: SentFile[],
  options: { fill?: boolean; now?: Date; draft?: number | null } = {},
): Promise<{ ok: true; fields: Record<string, unknown> } | Refusal> {
  if (!actor) return refuse('signed-out')
  const now = options.now ?? new Date()
  const had = await heldFilesFor(actor, heldIdsIn(fields.files), {
    now,
    draft: options.draft,
  })
  const replacing = sent.some((file) => file.slot === 'export')
  const keeping = had.filter((file) => !(replacing && file.kind === 'export'))
  const adding = sent.filter((file) => file.slot === 'added').length
  if (
    keeping.filter((file) => file.kind !== 'export').length + adding >
    MAX_ADDED_FILES
  ) {
    return refuse('invalid', {
      addedFiles: `Add up to ${MAX_ADDED_FILES} files beside the export.`,
    })
  }
  // What the form no longer holds goes before the count is made. The export
  // being replaced stays until its replacement is read.
  await letGoOfHeldFiles(
    db,
    actor,
    had.map((file) => file.id),
  )
  const result = await holdFiles(actor, sent, now)
  if (!result.ok) return result
  const files = [...keeping, ...result.held]
  if (replacing) {
    await letGoOfHeldFiles(
      db,
      actor,
      files.map((file) => file.id),
    )
  }
  const next: Record<string, unknown> = {
    ...fields,
    files: files.map((file) => file.id),
  }
  const summary = result.held.find((file) => file.kind === 'export')?.summary
  if (options.fill && summary) {
    // What the export being replaced filled in was not typed, so it goes too.
    const before = had.find((file) => file.kind === 'export')?.summary
    const filledIn = {
      title: before?.name.slice(0, 80),
      description: before?.description,
    }
    const blank = (name: keyof typeof filledIn) => {
      const value = String(fields[name] ?? '').trim()
      return !value || value === filledIn[name]?.trim()
    }
    if (blank('title') && summary.name) next.title = summary.name.slice(0, 80)
    if (blank('description')) next.description = summary.description
    if (summary.teams.length > 0) {
      next.teamPlayers = summary.teams.map((team) => String(team.players))
      next.teamBots = summary.teams.map((team) => String(team.bots))
    }
    next.built = summary.types
  }
  return { ok: true, fields: next }
}
