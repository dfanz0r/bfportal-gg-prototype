import { auth } from '.'

/**
 * Signs the visitor out and sends them home.
 *
 * It goes through Better Auth's HTTP handler, not its server API, because the
 * handler is what checks where a request came from. Called directly, the API
 * would sign someone out for any site that could get their browser to post
 * here. A request the handler refuses is refused here too, with its answer.
 */
export async function signOutAndRedirect(request: Request) {
  const headers = new Headers(request.headers)
  // The form posts no JSON; the endpoint expects some.
  headers.set('content-type', 'application/json')
  headers.delete('content-length')

  const answer = await auth.handler(
    new Request(new URL('/api/auth/sign-out', request.url), {
      method: 'POST',
      headers,
      body: '{}',
    }),
  )
  if (!answer.ok) {
    return answer
  }

  const redirect = new Headers({ Location: '/' })
  // The handler's answer carries the cookies that end the session.
  for (const cookie of answer.headers.getSetCookie()) {
    redirect.append('Set-Cookie', cookie)
  }
  return new Response(null, { status: 303, headers: redirect })
}
