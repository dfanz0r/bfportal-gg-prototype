/** Values shared by the database enums, the forms and the API. */

export const games = ['bf2042', 'bf6'] as const
export type Game = (typeof games)[number]

/**
 * Where an experience, a snippet or an update post is on its way to being
 * public, and after.
 *
 * - `draft`: saved by its owner and not sent in. Only they see it.
 * - `pending`: sent in and waiting for a moderator. The site says "In review".
 * - `changes_requested`: a moderator sent it back with notes. Its owner fixes
 *   it and sends it again, which makes it `pending` once more.
 * - `published`: public. The site says "Live".
 * - `unpublished`: taken off the listings by a moderator.
 * - `removed`: ended by a moderator, for spam or something badly wrong. It
 *   cannot be sent in again.
 */
export const contentStatuses = [
  'draft',
  'pending',
  'changes_requested',
  'published',
  'unpublished',
  'removed',
] as const
export type ContentStatus = (typeof contentStatuses)[number]

/** How the site names each status to the person whose submission it is. */
export const contentStatusLabels: Record<ContentStatus, string> = {
  draft: 'Draft',
  pending: 'In review',
  changes_requested: 'Changes requested',
  published: 'Live',
  unpublished: 'Delisted',
  removed: 'Removed',
}

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

/**
 * An edit to something published. One a moderator sends back is not thrown
 * away: its owner reopens it, fixes it and sends it again.
 */
export const revisionStatuses = [
  'pending',
  'approved',
  'changes_requested',
] as const
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

/**
 * A playtest brief. An approved one is open until it closes, which is when
 * the playtest is completed: `closes_at` says so, not a status of its own.
 */
export const playtestStatuses = [
  'pending',
  'approved',
  'changes_requested',
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

export const tagGroupFilterLabels: Record<TagGroupFilter, string> = {
  own: 'Its own filter',
  shared: 'In the tag filter',
  none: 'Not a filter',
}

/** Whether an experience may carry several tags from one group. */
export const tagGroupPicks = ['any', 'one'] as const
export type TagGroupPick = (typeof tagGroupPicks)[number]

export const tagGroupPickLabels: Record<TagGroupPick, string> = {
  any: 'Any number',
  one: 'One at most',
}

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
