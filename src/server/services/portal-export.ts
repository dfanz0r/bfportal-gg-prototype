import { z } from 'zod'

import type { ExperienceType, FileKind } from '../../shared/content'
import type { ExportSummary } from '../../shared/project-files'

// A Battlefield 6 Portal experience export: the JSON file Portal's Export
// button writes. Ported from the old site's `bf6/models/bf_experience_export.py`,
// and checked against real exports. Nothing is read from one until it parses.

/** Portal's codes for what an attachment is, as its exports write them. */
const ATTACHMENT = { spatial: 1, script: 2, strings: 4 } as const

/**
 * What Portal shows an exported mode as. Both exports seen so far call theirs
 * `ModBuilderCustom`, shown as Custom.
 */
const MODE_NAMES: Record<string, string> = { ModBuilderCustom: 'Custom' }

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * The most an export may hold of what is stored one row each. A 20-map
 * rotation exports 22 attachments, one layout a map and three more, so these
 * leave room for any real one. More is not an export.
 */
const MAX_MAPS = 100
const MAX_ATTACHMENTS = MAX_MAPS + 28
const MAX_TEAMS = 64

const base64 = z
  .string()
  .refine(
    (value) => value.length % 4 === 0 && BASE64.test(value),
    'is not base64',
  )

const attachmentSchema = z.object({
  filename: z.string().max(300),
  attachmentType: z.number().int(),
  /** `mapIdx=<n>` on a spatial layout: which map of the rotation it is for. */
  metadata: z.string().nullish(),
  attachmentData: z.object({
    original: base64.default(''),
    compiled: base64.default(''),
  }),
})

const exportSchema = z.object({
  name: z.string(),
  description: z.string().default(''),
  gameMode: z.string(),
  mapRotation: z
    .array(z.object({ id: z.string().max(200) }))
    .max(MAX_MAPS)
    .default([]),
  workspace: z
    .object({
      mod: z
        .object({
          blocks: z
            .object({ blocks: z.array(z.unknown()).default([]) })
            .default({ blocks: [] }),
        })
        .default({ blocks: { blocks: [] } }),
    })
    .default({ mod: { blocks: { blocks: [] } } }),
  /** `[team number, sizes]` for each team. */
  teamComposition: z
    .array(
      z.tuple([
        z.number(),
        z.object({
          humanCapacity: z.number().int().min(0).default(0),
          aiCapacity: z.number().int().min(0).default(0),
        }),
      ]),
    )
    .max(MAX_TEAMS)
    .default([]),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).default([]),
})

type Export = z.infer<typeof exportSchema>
type Attachment = z.infer<typeof attachmentSchema>

const decodeText = (base64: string) =>
  Buffer.from(base64, 'base64').toString('utf8')

const decode = (attachment: Attachment) =>
  decodeText(attachment.attachmentData.original)

/**
 * The blocks in the rules editor. Every mod has one `modBlock` holding the
 * rest, so an export with none of its own has that one alone. Walked without
 * recursion, since a long rule nests deeply, and pushed one at a time: a
 * spread passes each item as an argument, and a long array is more
 * arguments than a call takes.
 */
function countBlocks(blocks: unknown[]) {
  let total = 0
  const waiting: unknown[] = []
  const add = (items: unknown[]) => {
    for (const item of items) waiting.push(item)
  }
  add(blocks)
  while (waiting.length > 0) {
    const node = waiting.pop()
    if (Array.isArray(node)) {
      add(node)
    } else if (node && typeof node === 'object') {
      const { type } = node as { type?: unknown }
      if (typeof type === 'string' && 'id' in node && type !== 'modBlock') {
        total += 1
      }
      add(Object.values(node))
    }
  }
  return total
}

/** Its level id, from a rotation entry's id such as `MP_Abbasid-ModBuilderCustom0`. */
export const levelIdOf = (entryId: string) => entryId.split('-')[0] ?? entryId

function summarize(read: Export): ExportSummary {
  const script = read.attachments.find(
    (item) => item.attachmentType === ATTACHMENT.script,
  )
  const source = script ? decode(script).trimEnd() : ''
  const scriptLines = source ? source.split('\n').length : 0
  const blocks = countBlocks(read.workspace.mod.blocks.blocks)
  const spatialLayouts = read.attachments.filter(
    (item) =>
      item.attachmentType === ATTACHMENT.spatial &&
      item.attachmentData.original !== '',
  ).length
  const types: ExperienceType[] = []
  if (scriptLines > 0) types.push('script')
  if (blocks > 0) types.push('blocks')
  if (spatialLayouts > 0) types.push('spatial')
  return {
    name: read.name.trim(),
    description: read.description.trim(),
    teams: [...read.teamComposition]
      .sort(([one], [other]) => one - other)
      .map(([, sizes]) => ({
        players: sizes.humanCapacity,
        bots: sizes.aiCapacity,
      })),
    mode: MODE_NAMES[read.gameMode] ?? read.gameMode,
    maps: read.mapRotation.map((entry) => levelIdOf(entry.id)),
    scriptLines,
    blocks,
    spatialLayouts,
    types,
  }
}

/** An export read from its text, or null if it is not one. */
export function readExport(
  text: string,
): { summary: ExportSummary; export: Export } | null {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const read = exportSchema.safeParse(json)
  return read.success
    ? { summary: summarize(read.data), export: read.data }
    : null
}

/** What an attachment is by its name, where its type is not one known. */
function kindByName(filename: string): FileKind {
  const name = filename.toLowerCase()
  if (name.endsWith('.ts')) return 'script'
  if (name.endsWith('.strings.json')) return 'strings'
  if (name.endsWith('.spatial.json')) return 'spatial'
  return 'other'
}

/**
 * The files inside an export, each as its own text, to share beside it: the
 * script, its strings, each map's spatial layout in the rotation's order, and
 * anything else it carries. Every attachment with something in it is kept,
 * whatever its type: one whose type is not known goes by its name. Only empty
 * ones are left out.
 */
export function filesInExport(read: Export) {
  const kinds: Record<number, FileKind> = {
    [ATTACHMENT.script]: 'script',
    [ATTACHMENT.strings]: 'strings',
    [ATTACHMENT.spatial]: 'spatial',
  }
  const order: FileKind[] = ['script', 'strings', 'spatial', 'other']
  const files = read.attachments.flatMap((attachment) => {
    const kind =
      kinds[attachment.attachmentType] ?? kindByName(attachment.filename)
    // Portal writes what was uploaded as the original. Where only the
    // compiled copy has anything, that is what there is.
    const { original, compiled } = attachment.attachmentData
    const body = decodeText(original || compiled)
    if (!body.trim()) return []
    // A map of the rotation it has, or none.
    const index = Number(attachment.metadata?.match(/^mapIdx=(\d{1,3})$/)?.[1])
    return [
      {
        kind,
        filename: attachment.filename,
        body,
        mapIndex:
          Number.isInteger(index) && index < read.mapRotation.length
            ? index
            : null,
      },
    ]
  })
  return files.sort(
    (one, other) =>
      order.indexOf(one.kind) - order.indexOf(other.kind) ||
      (one.mapIndex ?? 0) - (other.mapIndex ?? 0),
  )
}
