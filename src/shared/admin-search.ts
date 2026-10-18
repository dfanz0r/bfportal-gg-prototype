import { z } from 'zod'

import { type ContentStatus, games, reportTypes } from './content'
import { roles } from './roles'

// The admin screens' filters, as they appear in their addresses, and the
// values behind them. As with the Library, a value that does not parse is
// dropped, never an error, and a default is left out of the address.

/** How many rows one page of an admin list shows. */
export const ADMIN_PAGE = 25
/** "Show more" grows the page. This is where it stops. */
export const ADMIN_MAX_PAGES = 20

/** Reports still to deal with, or those dealt with. */
export const reportStates = ['open', 'dismissed'] as const
export type ReportState = (typeof reportStates)[number]

export const reportSorts = ['most', 'latest'] as const
export type ReportSort = (typeof reportSorts)[number]

/** The states an admin list shows. A draft has been sent to nobody. */
export const adminStatuses = [
  'pending',
  'changes_requested',
  'published',
  'unpublished',
  'removed',
] as const satisfies readonly ContentStatus[]
export type AdminStatus = (typeof adminStatuses)[number]

/** What can be wrong with an experience, as a moderator filters by it. */
export const healthFlags = [
  'bugged',
  'broken',
  'xp_farm',
  'unavailable',
] as const
export type HealthFlag = (typeof healthFlags)[number]

/** How the admin names each flag, and each kind of report. */
export const healthFlagLabels: Record<HealthFlag, string> = {
  bugged: 'Bugged',
  broken: 'Broken',
  xp_farm: 'XP farm',
  unavailable: 'Not available',
}

export const adminSorts = ['newest', 'likes', 'reports'] as const
export type AdminSort = (typeof adminSorts)[number]

export const snippetSorts = ['newest', 'likes'] as const

/** An address with a search, its empty parts left out. */
export function searchHref(
  path: string,
  search: Record<string, string | number | boolean | undefined>,
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

/** One of a fixed set, or nothing. */
const oneOf = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined)

const text = z
  .preprocess(
    (value) =>
      value === undefined ? undefined : String(value).trim() || undefined,
    z.string().max(100).optional(),
  )
  .catch(undefined)

/** On, from an address (`true`) or a checkbox (`"true"`); otherwise left out. */
const flag = z
  .preprocess(
    (value) => (value === true || value === 'true' ? true : undefined),
    z.literal(true).optional(),
  )
  .catch(undefined)

/** The first page has no number in the address. */
const page = z.coerce
  .number()
  .int()
  .min(2)
  .max(ADMIN_MAX_PAGES)
  .optional()
  .catch(undefined)

export const reportsSearchSchema = z.object({
  state: oneOf(['dismissed']),
  game: oneOf(games),
  kind: oneOf(reportTypes),
  sort: oneOf(['latest']),
})
export type ReportsSearch = z.infer<typeof reportsSearchSchema>

export const adminExperiencesSearchSchema = z.object({
  status: oneOf(adminStatuses),
  game: oneOf(games),
  q: text,
  flag: oneOf(healthFlags),
  featured: flag,
  trending: flag,
  reported: flag,
  sort: oneOf(['likes', 'reports']),
  page,
})
export type AdminExperiencesSearch = z.infer<
  typeof adminExperiencesSearchSchema
>

export const adminSnippetsSearchSchema = z.object({
  status: oneOf(adminStatuses),
  q: text,
  sort: oneOf(['likes']),
  page,
})
export type AdminSnippetsSearch = z.infer<typeof adminSnippetsSearchSchema>

export const usersSearchSchema = z.object({
  q: text,
  role: oneOf(roles),
  page,
})
export type UsersSearch = z.infer<typeof usersSearchSchema>

export const taxonomySearchSchema = z.object({
  /** The first game has no name in the address. */
  game: oneOf(games),
})
