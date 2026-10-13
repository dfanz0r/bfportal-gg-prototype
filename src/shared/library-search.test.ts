import { describe, expect, it } from 'vitest'

import {
  librarySearchParams,
  librarySearchSchema,
  readLibraryAddress,
} from './library-search'

const parse = (input: unknown) => librarySearchSchema.parse(input)

describe('library search', () => {
  it('reads tags however the address carries them', () => {
    // The router has already made "1942" a number and a repeated key a list.
    expect(parse({ tag: 1942 }).tag).toEqual(['1942'])
    expect(parse({ tag: 'BC2,no-vehicles' }).tag).toEqual([
      'bc2',
      'no-vehicles',
    ])
    expect(parse({ tag: ['bc2', 2042] }).tag).toEqual(['bc2', '2042'])
    expect(parse({}).tag).toBeUndefined()
  })

  it('drops what it cannot read and keeps the rest', () => {
    expect(
      parse({
        sort: 'sideways',
        page: 'lots',
        players: 'gigantic',
        built: 'script,magic',
        featured: 'yes',
        q: '  rush  ',
      }),
    ).toEqual({ q: 'rush' })
    expect(parse({ page: 3, built: 'script,spatial', free: true })).toEqual({
      page: 3,
      built: ['script', 'spatial'],
      free: true,
    })
    expect(parse({ page: 9999 }).page).toBeUndefined()
  })

  it('writes an address with lists joined and nothing empty', () => {
    expect(
      librarySearchParams({ tag: ['bc2', '1942'], q: '', page: 1, built: [] }),
    ).toEqual({ tag: 'bc2.1942' })
  })

  it('reads its own addresses back unchanged', () => {
    const address = readLibraryAddress({
      tag: 'bc2.1942',
      built: 'script',
      page: 2,
    })
    expect(address).toEqual({ tag: 'bc2.1942', built: 'script', page: 2 })
    expect(readLibraryAddress(address)).toEqual(address)
    // An old link with a tag's name keeps the name whole.
    expect(readLibraryAddress({ tag: 'VEHICLE MODIFIERS' }).tag).toBe(
      'vehicle modifiers',
    )
  })
})
