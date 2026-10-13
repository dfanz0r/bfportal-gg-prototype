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
  'experience_sub',
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

/** Where a banner shows. */
export const bannerPlacements = ['home', 'everywhere'] as const
export type BannerPlacement = (typeof bannerPlacements)[number]

export const playtestStatuses = ['active', 'cancelled'] as const
export type PlaytestStatus = (typeof playtestStatuses)[number]

/** The regions testers sign up for. Each has a Tester role in Discord. */
export const testerRegions = ['eu', 'na', 'sa', 'asia', 'oce'] as const
export type TesterRegion = (typeof testerRegions)[number]
