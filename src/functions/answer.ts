import type { Refusal } from '../shared/results'

/**
 * What a plain HTML form gets back from a write: a redirect, since there is no
 * script to read an answer. Someone not signed in is sent to sign in; anyone
 * else goes back where they were. Throw it from the handler.
 */
export function formAnswer(result: { ok: true } | Refusal, back: string) {
  const to = !result.ok && result.reason === 'signed-out' ? '/login' : back
  return new Response(null, { status: 303, headers: { Location: to } })
}
