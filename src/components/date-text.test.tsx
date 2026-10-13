// @vitest-environment happy-dom
import { render } from 'solid-js/web'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as dates from '../shared/dates'
import { DateText } from './date-text'

// Late on the 16th in UTC is still the 16th in Chicago, and already the 17th
// in Tokyo.
const LATE = new Date('2026-10-17T02:30:00Z')

function mount(zone: string) {
  vi.spyOn(dates, 'browserTimeZone').mockReturnValue(zone)
  const host = document.createElement('div')
  const dispose = render(() => <DateText value={LATE} />, host)
  return { host, dispose }
}

describe('DateText', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the visitor their own date once the page is running', async () => {
    const chicago = mount('America/Chicago')
    await Promise.resolve()
    expect(chicago.host.textContent).toBe('Oct 16, 2026')
    expect(chicago.host.querySelector('time')?.title).toMatch(/9:30 PM/)
    chicago.dispose()

    const tokyo = mount('Asia/Tokyo')
    await Promise.resolve()
    expect(tokyo.host.textContent).toBe('Oct 17, 2026')
    tokyo.dispose()
  })

  it('always carries the exact moment for machines', () => {
    const { host, dispose } = mount('America/Chicago')
    expect(host.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-10-17T02:30:00.000Z',
    )
    dispose()
  })
})
