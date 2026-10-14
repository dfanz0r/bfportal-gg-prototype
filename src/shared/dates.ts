// How the site writes dates. The server and the browser must write the same
// thing or the page will not hydrate, so nothing here reads the clock or the
// visitor's locale: the language is fixed, the time zone is passed in, and
// "ago" is measured from a time the caller supplies.

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "Oct 16, 2026". UTC unless told the visitor's time zone. */
export function formatDate(date: Date, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(date)
}

/** The day of the month and the month's short name, "16" and "Oct". */
export function formatDayAndMonth(date: Date, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    timeZone,
  }).formatToParts(date)
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return { day: part('day'), month: part('month') }
}

/** "Oct 16, 2026, 8:30 PM UTC", for a tooltip. */
export function formatDateTime(date: Date, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  }).format(date)
}

/**
 * "5 hours ago", for something within the last week of `now`. Null for
 * anything older or in the future, which is better shown as a date.
 */
export function formatAgo(date: Date, now: Date) {
  const elapsed = now.getTime() - date.getTime()
  if (elapsed < 0 || elapsed >= 7 * DAY) return null
  if (elapsed < MINUTE) return 'just now'
  const count = (unit: number, name: string) => {
    const value = Math.floor(elapsed / unit)
    return `${value} ${name}${value === 1 ? '' : 's'} ago`
  }
  if (elapsed < HOUR) return count(MINUTE, 'minute')
  if (elapsed < DAY) return count(HOUR, 'hour')
  return count(DAY, 'day')
}

/**
 * The visitor's time zone, as the browser reports it. Only meaningful in the
 * browser: on the server it is the server's.
 */
export function browserTimeZone() {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** "14 KB", for a file. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`
  return `${(kilobytes / 1024).toFixed(1)} MB`
}
