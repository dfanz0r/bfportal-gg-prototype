import { describe, expect, it } from 'vitest'

import { isFromThisSite } from './origin'

const SITE = ['https://bfportal.gg']
const from = (origin?: string) =>
  new Headers(origin === undefined ? {} : { origin })

describe('where a request came from', () => {
  it("accepts the site's own pages", () => {
    expect(isFromThisSite(from('https://bfportal.gg'), SITE)).toBe(true)
  })

  it.each([
    ['another site', 'https://evil.example'],
    ['a sibling under the same domain', 'https://other.bfportal.gg'],
    ['the same host over plain HTTP', 'http://bfportal.gg'],
    ['a lookalike', 'https://bfportal.gg.evil.example'],
    ['a sandboxed page', 'null'],
  ])('refuses %s', (_, origin) => {
    expect(isFromThisSite(from(origin), SITE)).toBe(false)
  })

  it('refuses a request that does not say', () => {
    expect(isFromThisSite(from(), SITE)).toBe(false)
  })
})
