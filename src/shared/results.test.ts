import { describe, expect, it } from 'vitest'

import { safeBackPath } from './results'

describe('where to send someone back to', () => {
  it.each([
    '/experiences/gun-master',
    '/library?tag=bc2.bf3&page=2',
    '/users/123#liked',
  ])('keeps a path on this site: %s', (path) => {
    expect(safeBackPath(path)).toBe(path)
  })

  it.each([
    ['another site', 'https://evil.example/x'],
    ['two slashes', '//evil.example/x'],
    ['a backslash, which browsers read as a slash', '/\\evil.example/x'],
    ['a backslash further in', '/x\\..\\evil'],
    ['a tab a browser would strip', '/\t/evil.example'],
    ['a line break', '/\n/evil.example'],
    ['no leading slash', 'evil.example'],
    ['a script address', 'javascript:alert(1)'],
    ['nothing', ''],
    ['something that is not text', 42],
  ])('sends %s home instead', (_, value) => {
    expect(safeBackPath(value)).toBe('/')
  })
})
