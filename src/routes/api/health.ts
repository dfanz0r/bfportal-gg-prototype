import { createFileRoute } from '@tanstack/solid-router'

import { sql } from '../../server/db'

const PROBE_TIMEOUT_MS = 2000

async function probeDatabase() {
  const query = sql`select 1`
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      query.cancel()
      reject(new Error(`no answer within ${PROBE_TIMEOUT_MS} ms`))
    }, PROBE_TIMEOUT_MS)
  })
  try {
    await Promise.race([query, deadline])
  } finally {
    clearTimeout(timer)
  }
}

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await probeDatabase()
          return Response.json({ status: 'ok' })
        } catch (error) {
          console.error('Health check: database unreachable.', error)
          return Response.json(
            { status: 'database unreachable' },
            { status: 503 },
          )
        }
      },
    },
  },
})
