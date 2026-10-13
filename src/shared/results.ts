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

const NOWHERE = 'https://nowhere.invalid'

/**
 * A path on this site to send someone back to, or the home page.
 *
 * Checked by resolving it the way a browser would and seeing where it lands.
 * "//host" is another site, and so is "/\\host": browsers read a backslash as
 * a slash. Control characters are stripped by browsers before they parse, so
 * a path carrying any is refused outright.
 */
export function safeBackPath(value: unknown) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what this looks for
    /[\\\u0000-\u001f\u007f]/.test(value)
  ) {
    return '/'
  }
  try {
    const url = new URL(value, NOWHERE)
    return url.origin === NOWHERE
      ? `${url.pathname}${url.search}${url.hash}`
      : '/'
  } catch {
    return '/'
  }
}
