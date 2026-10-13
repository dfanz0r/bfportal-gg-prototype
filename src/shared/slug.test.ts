import { describe, expect, it } from 'vitest'

import { slugify } from './slug'

describe('slugify', () => {
  it('joins words with hyphens', () => {
    expect(slugify('Capture the Flag: Siege of Cairo')).toBe(
      'capture-the-flag-siege-of-cairo',
    )
    expect(slugify('  !!Gun  Master 2.0!!  ')).toBe('gun-master-2-0')
  })

  it('keeps accented letters as their plain ones', () => {
    expect(slugify('Café Zürich: Opération Éclair')).toBe(
      'cafe-zurich-operation-eclair',
    )
    expect(slugify('Straße nach Łódź, Søren')).toBe('strasse-nach-lodz-soren')
  })

  it('comes out empty for a title with nothing to keep', () => {
    expect(slugify('戦場')).toBe('')
    expect(slugify('!!!')).toBe('')
  })
})
