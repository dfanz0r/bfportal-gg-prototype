import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/solid-start'

import { MAX_REQUEST_BYTES } from './shared/project-files'

// What every request to the site goes through before anything else reads it.

/**
 * A request with a body says how long it is, and is no longer than any form
 * here can send, or it is refused before it is read: nothing parses a body
 * that could fill the server's memory. Every browser says how long what it
 * sends is.
 */
const bodyLimit = createMiddleware().server(({ request, next }) => {
  if (request.method === 'GET' || request.method === 'HEAD') return next()
  const declared = request.headers.get('content-length')
  if (declared === null) {
    // A body that streams in with no length could be any length.
    if (request.body === null) return next()
    return new Response('Say how long the request is.', { status: 411 })
  }
  const length = Number(declared)
  if (!Number.isSafeInteger(length) || length < 0) {
    return new Response('That request length does not read.', { status: 400 })
  }
  if (length > MAX_REQUEST_BYTES) {
    return new Response('That is more than the site takes at once.', {
      status: 413,
    })
  }
  return next()
})

/**
 * Server functions take requests from this site's own pages only. Start adds
 * this by itself until a start file names its own middleware, as this one
 * does; each server function that writes also checks the origin itself.
 */
const csrf = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [bodyLimit, csrf],
}))
