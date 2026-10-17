import type { ExperienceType, FileKind } from './content'

// The files behind a project: a Portal export, and what a creator adds beside
// it. See "Project files" in PLAN.md.

/**
 * The largest export taken. Portal writes every map's layout into the export
 * twice, so one with many custom maps is several megabytes: the Custom
 * Conquest template, with 20, is 5 MB.
 */
export const MAX_EXPORT_BYTES = 10 * 1024 * 1024
/** The largest file added beside the export, such as a Godot scene. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024
/** How many files may be added beside the export. */
export const MAX_ADDED_FILES = 10
/** What may be added beside the export. */
export const ADDED_FILE_TYPES = ['.tscn', '.ts', '.json']

/** What a stored file's public id looks like: 32 hex digits. */
export const FILE_ID = /^[0-9a-f]{32}$/

/** The short label drawn for a file of each kind. */
export const fileGlyphs: Record<FileKind, string> = {
  export: 'JSON',
  script: 'TS',
  spatial: 'JSON',
  scene: 'TSCN',
  strings: 'JSON',
  other: 'FILE',
}

/** What an export holds, as the form shows it once it is read. */
export type ExportSummary = {
  name: string
  description: string
  /** People and bots on each team, in Portal's order. */
  teams: { players: number; bots: number }[]
  /** The game mode, as Portal shows it. */
  mode: string
  /** Portal's level id for each map of the rotation, in order. */
  maps: string[]
  /** Lines of TypeScript; 0 when the script is empty. */
  scriptLines: number
  /** Blocks in the rules editor, not counting the one every mod starts with. */
  blocks: number
  /** Maps with a spatial layout. */
  spatialLayouts: number
  /** What it is built with, as the form's "Built with" says it. */
  types: ExperienceType[]
}
