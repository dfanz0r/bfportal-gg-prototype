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
