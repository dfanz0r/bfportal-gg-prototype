import { describe, expect, it } from 'vitest'

import { allow } from './rate-limit'

describe('a limit on how often', () => {
  it('allows so many in a window, then none until the next', () => {
    const key = `test:${Math.random()}`
    const minute = 60_000
    expect([1, 2, 3, 4].map(() => allow(key, 3, minute, 1000))).toEqual([
      true,
      true,
      true,
      false,
    ])
    // Still inside the window.
    expect(allow(key, 3, minute, 1000 + minute - 1)).toBe(false)
    expect(allow(key, 3, minute, 1000 + minute)).toBe(true)
  })

  it('counts each key on its own', () => {
    const a = `a:${Math.random()}`
    const b = `b:${Math.random()}`
    expect(allow(a, 1, 1000, 0)).toBe(true)
    expect(allow(a, 1, 1000, 0)).toBe(false)
    expect(allow(b, 1, 1000, 0)).toBe(true)
  })
})
