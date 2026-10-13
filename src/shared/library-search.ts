import { z } from 'zod'

import { experienceTypes } from './content'

// The Library's filters, as they appear in its address. The route validates
// the address against this, and the server function validates its input
// against it again, so the page, the query and a pasted link agree.
//
// The router turns "1942" into a number and a repeated key into a list before
// this sees them, so every field takes what the router might hand it and
// settles on one plain form.
//
// In an address a list is one value joined with dots: `tag=bc2.bf3`. The
// router writes a real list as JSON, and a comma would be percent-encoded;
// a dot is neither, and no slug contains one. Something that does not parse is dropped, never
// an error: an old or mistyped link still shows the Library.

export const PAGE_SIZE = 12
/** "Show more" grows the page. This is where it stops. */
export const MAX_PAGES = 20

export const librarySorts = ['trending', 'newest', 'likes'] as const
export type LibrarySort = (typeof librarySorts)[number]

/** Lobby sizes: ranges of the most players a match holds. */
export const playerRanges = {
  small: { label: 'Up to 8 players', min: 0, max: 8 },
  medium: { label: '9 to 32 players', min: 9, max: 32 },
  large: { label: '33 to 64 players', min: 33, max: 64 },
  huge: { label: 'More than 64 players', min: 65, max: null },
} as const
export type PlayerRange = keyof typeof playerRanges

/** One value, several joined with dots or commas, or a list of either. */
const list = z
  .preprocess(
    (value) =>
      (Array.isArray(value) ? value : [value])
        .flatMap((item) => String(item ?? '').split(/[.,]/))
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    z.array(z.string().max(80)).max(30),
  )
  .catch([])

const text = z
  .preprocess(
    (value) => (value === undefined ? undefined : String(value).trim()),
    z.string().max(100),
  )
  .optional()
  .catch(undefined)

const flag = z.literal(true).optional().catch(undefined)

export const librarySearchSchema = z.object({
  q: text,
  category: text,
  /** Tag slugs, from any of the game's tag groups. */
  tag: list.optional(),
  built: z
    .preprocess((value) => list.parse(value), z.array(z.enum(experienceTypes)))
    .optional()
    .catch(undefined),
  players: z
    .enum(Object.keys(playerRanges) as [PlayerRange, ...PlayerRange[]])
    .optional()
    .catch(undefined),
  featured: flag,
  templates: flag,
  /** Only what the free version can play. */
  free: flag,
  /** Only what earns full XP. */
  xp: flag,
  /** Include what no longer loads, which is hidden otherwise. */
  unavailable: flag,
  sort: z.enum(librarySorts).optional().catch(undefined),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGES)
    .optional()
    .catch(undefined),
})

export type LibrarySearch = z.infer<typeof librarySearchSchema>

/**
 * The address form of a search: empty filters left out, and lists joined with
 * dots. A route keeps its search in this form, so the address it is given and
 * the one it would write are the same and nobody is redirected to tidy it.
 */
export function librarySearchParams(search: LibrarySearch) {
  const join = (values?: string[]) =>
    values && values.length > 0 ? values.join('.') : undefined
  return {
    ...search,
    q: search.q || undefined,
    category: search.category || undefined,
    tag: join(search.tag),
    built: join(search.built),
    page: search.page && search.page > 1 ? search.page : undefined,
  }
}

/** A Library address's search: every part of it is optional. */
export type LibraryAddress = Partial<ReturnType<typeof librarySearchParams>>

/** Reads an address into its tidy form. What a Library route validates with. */
export function readLibraryAddress(input: unknown): LibraryAddress {
  return librarySearchParams(librarySearchSchema.parse(input))
}
