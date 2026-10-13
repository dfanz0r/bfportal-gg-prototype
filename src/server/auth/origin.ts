/**
 * Whether a request that changes something came from the site's own pages.
 * A browser states the page's origin on every POST, and another site cannot
 * forge it. One with no origin at all is refused.
 */
export function isFromThisSite(headers: Headers, origins: string[]) {
  const origin = headers.get('origin')
  return origin !== null && origins.includes(origin)
}
