// How a write answers. A refusal the site expects (not signed in, not
// allowed, nothing there, bad input) is a value to show, not an error thrown.

export type Refusal = {
  ok: false
  reason: 'signed-out' | 'forbidden' | 'not-found' | 'invalid'
  /** For `invalid`: what is wrong, by field. */
  errors?: Record<string, string>
}

export const refuse = (
  reason: Refusal['reason'],
  errors?: Record<string, string>,
): Refusal => ({ ok: false, reason, ...(errors ? { errors } : {}) })

/** A path on this site to send someone back to, or the home page. */
export function safeBackPath(value: unknown) {
  // One slash, then not another: "//host" is another site.
  return typeof value === 'string' && /^\/(?!\/)/.test(value) ? value : '/'
}
