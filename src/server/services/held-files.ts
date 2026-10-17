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
 * The most one account holds at once, in files and in size: enough for a few
 * forms open together, each with its export, every file the form takes beside
 * it, and an export about to replace the first. Each costs space here, so it
 * is counted, under a lock on the account, in the same transaction as the
 * write. A form only lets go of its own files, so what an abandoned form held
 * counts until it is let go a day later.
 */
const MAX_HELD = (MAX_ADDED_FILES + 2) * 3
const MAX_HELD_BYTES = 64 * 1024 * 1024

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

/**
 * The same, with what each file says, to store, held still until the
 * transaction ends: another form letting go of them meanwhile waits, and
 * finds them gone.
 */
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
    .for('update')
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
 * Lets go of the loose files in `ids` held for someone. Only those: another
 * form of theirs may be open, holding its own. Files saved with a draft are
 * the draft's, and stay.
 */
export async function letGoOfHeldFiles(
  executor: Executor,
  actor: Actor,
  ids: string[],
) {
  const going = heldIdsIn(ids)
  if (going.length === 0) return
  await executor
    .delete(heldFiles)
    .where(
      and(
        eq(heldFiles.uploadedBy, actor.id),
        loose,
        inArray(heldFiles.id, going),
      ),
    )
}

/** How many expired files one sweep lets go of, so no upload waits long on it. */
const SWEEP_BATCH = 50

/**
 * Lets go of loose files whose day has run out, anyone's, a batch at a time.
 * Each upload sweeps once, so an account that never comes back does not keep
 * what it chose. Rows another sweep has hold of are left to it.
 */
export async function sweepHeldFiles(executor: Executor, now = new Date()) {
  const cutoff = new Date(now.getTime() - HELD_FOR)
  await executor.execute(sql`
    delete from ${heldFiles} where ${heldFiles.id} in (
      select ${heldFiles.id} from ${heldFiles}
      where ${heldFiles.experienceId} is null
        and ${heldFiles.createdAt} < ${cutoff.toISOString()}::timestamptz
      limit ${SWEEP_BATCH}
      for update skip locked
    )`)
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
    await sweepHeldFiles(tx, now)
    // A draft's files are counted with the drafts, not here.
    const [holding] = await tx
      .select({
        files: count(),
        bytes:
          sql<number>`coalesce(sum(${heldFiles.sizeBytes}), 0)::bigint`.mapWith(
            Number,
          ),
      })
      .from(heldFiles)
      .where(and(eq(heldFiles.uploadedBy, actor.id), loose))
    const adding = ready.reduce((sum, row) => sum + row.sizeBytes, 0)
    if (
      holding.files + ready.length > MAX_HELD ||
      holding.bytes + adding > MAX_HELD_BYTES
    ) {
      return refuse('invalid', {
        [ready.some((row) => row.kind === 'export')
          ? 'exportFile'
          : 'addedFiles']:
          'You have as many files waiting as an account can hold. Each is let go a day after it was chosen.',
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
 * takes the place of the one it had. A file the form was drawn with and no
 * longer names, in `shownFiles`, was taken off it and is let go.
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
  // What the form was taken off goes before the count is made. The export
  // being replaced stays until its replacement is read.
  const named = new Set(heldIdsIn(fields.files))
  await letGoOfHeldFiles(
    db,
    actor,
    heldIdsIn(fields.shownFiles).filter((id) => !named.has(id)),
  )
  const result = await holdFiles(actor, sent, now)
  if (!result.ok) return result
  const files = [...keeping, ...result.held]
  if (replacing) {
    await letGoOfHeldFiles(
      db,
      actor,
      had.filter((file) => file.kind === 'export').map((file) => file.id),
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
