// A small limit on how often one account may do something, kept in memory.
//
// It is per process and forgotten on restart, which suits what it guards:
// calls to someone else's service that cost them, not us. Anything that must
// hold across restarts or several servers is counted in the database instead,
// as the limit on submissions is.

const windows = new Map<string, { startedAt: number; used: number }>()

/**
 * Whether `key` may act once more: at most `max` times in each `windowMs`.
 * Counts the attempt when it is allowed.
 */
export function allow(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
) {
  const current = windows.get(key)
  if (!current || now - current.startedAt >= windowMs) {
    // Old windows are dropped as they are found, so the map does not grow
    // with every account that ever looked something up.
    if (windows.size > 5000) {
      for (const [other, window] of windows) {
        if (now - window.startedAt >= windowMs) windows.delete(other)
      }
    }
    windows.set(key, { startedAt: now, used: 1 })
    return true
  }
  if (current.used >= max) return false
  current.used += 1
  return true
}

/**
 * Forgets every count, for tests: each starts with its accounts' allowances
 * whole, as a test of one thing should not run out of another's.
 */
export function forgetAllowances() {
  windows.clear()
}

/** How many codes one account may look up on Portal in a minute. */
const LOOKUPS_PER_MINUTE = 20

/**
 * Whether an account may ask gametools about one more code: by "Fetch
 * details" and by submitting alike, so a submission refused for its code is
 * not a way round the limit. Counts it when it may.
 */
export const allowLookup = (accountId: string, now = Date.now()) =>
  allow(`lookup:${accountId}`, LOOKUPS_PER_MINUTE, 60 * 1000, now)
