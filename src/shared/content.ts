/** Values shared by the database enums, the forms and the API. */

export const games = ['bf2042', 'bf6'] as const
export type Game = (typeof games)[number]

export const contentStatuses = [
  'pending',
  'published',
  'unpublished',
  'rejected',
] as const
export type ContentStatus = (typeof contentStatuses)[number]

export const categoryKinds = [
  'experience_main',
  'script_main',
  'script_sub',
] as const
export type CategoryKind = (typeof categoryKinds)[number]

export const reportTypes = ['bugged', 'broken', 'xp_farm'] as const
export type ReportType = (typeof reportTypes)[number]

export const revisionKinds = ['edit', 'clear_flags'] as const
export type RevisionKind = (typeof revisionKinds)[number]

export const revisionStatuses = ['pending', 'approved', 'rejected'] as const
export type RevisionStatus = (typeof revisionStatuses)[number]

/** What an uploaded project file is. */
export const fileKinds = [
  'export',
  'script',
  'spatial',
  'scene',
  'strings',
  'other',
] as const
export type FileKind = (typeof fileKinds)[number]

/**
 * What a Battlefield 6 experience is built with. `verified` stands alone: a
 * verified mode is official settings and a map rotation, with no script,
 * blocks or custom spatial data.
 */
export const experienceTypes = [
  'script',
  'blocks',
  'spatial',
  'verified',
] as const
export type ExperienceType = (typeof experienceTypes)[number]

/** How the site names each of them. */
export const experienceTypeLabels: Record<ExperienceType, string> = {
  script: 'Script',
  blocks: 'Blocks',
  spatial: 'Custom map',
  verified: 'Verified mode',
}

/** Where a banner shows. */
export const bannerPlacements = ['home', 'everywhere'] as const
export type BannerPlacement = (typeof bannerPlacements)[number]

export const playtestStatuses = [
  'pending',
  'approved',
  'rejected',
  'canceled',
] as const
export type PlaytestStatus = (typeof playtestStatuses)[number]

/** The regions testers sign up for. Each has a Tester role in Discord. */
export const testerRegions = ['eu', 'na', 'sa', 'asia', 'oce'] as const
export type TesterRegion = (typeof testerRegions)[number]

/**
 * How a tag group appears in a game's Library. `own` gives it a filter of its
 * own, `shared` puts its tags in the general tag picker, and `none` keeps it
 * off the filter row.
 */
export const tagGroupFilters = ['own', 'shared', 'none'] as const
export type TagGroupFilter = (typeof tagGroupFilters)[number]

/** Whether an experience may carry several tags from one group. */
export const tagGroupPicks = ['any', 'one'] as const
export type TagGroupPick = (typeof tagGroupPicks)[number]

/**
 * Where a tag on an experience came from: its creator, Portal's own tags for
 * the code, or the maps in its rotation.
 */
export const tagSources = ['creator', 'portal', 'map'] as const
export type TagSource = (typeof tagSources)[number]

/**
 * Whether Portal still has an experience's code, as the nightly check last saw
 * it. `unpublished` means Portal knows the code but no longer offers it;
 * `missing` means it does not know the code at all.
 */
export const portalStates = [
  'unchecked',
  'published',
  'unpublished',
  'missing',
] as const
export type PortalState = (typeof portalStates)[number]
