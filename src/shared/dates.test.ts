import { describe, expect, it } from 'vitest'

import { formatAgo, formatBytes, formatDate, formatDateTime } from './dates'

const at = (iso: string) => new Date(iso)
const NOW = at('2026-10-13T12:00:00Z')

describe('dates', () => {
  it('writes a date month first, in UTC unless given a time zone', () => {
    const late = at('2026-10-16T23:30:00Z')
    expect(formatDate(late)).toBe('Oct 16, 2026')
    // Already the next day in Tokyo.
    expect(formatDate(late, 'Asia/Tokyo')).toBe('Oct 17, 2026')
    expect(formatDateTime(at('2026-10-16T20:30:00Z'))).toBe(
      'Oct 16, 2026, 8:30 PM UTC',
    )
  })

  it('says how long ago, up to a week', () => {
    expect(formatAgo(at('2026-10-13T11:59:40Z'), NOW)).toBe('just now')
    expect(formatAgo(at('2026-10-13T11:59:00Z'), NOW)).toBe('1 minute ago')
    expect(formatAgo(at('2026-10-13T06:10:00Z'), NOW)).toBe('5 hours ago')
    expect(formatAgo(at('2026-10-12T11:00:00Z'), NOW)).toBe('1 day ago')
    expect(formatAgo(at('2026-10-07T12:00:00Z'), NOW)).toBe('6 days ago')
    expect(formatAgo(at('2026-10-06T12:00:00Z'), NOW)).toBeNull()
    expect(formatAgo(at('2026-10-14T12:00:00Z'), NOW)).toBeNull()
  })

  it('writes a file size', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(14 * 1024)).toBe('14 KB')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })
})
