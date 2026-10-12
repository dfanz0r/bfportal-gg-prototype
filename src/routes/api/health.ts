import { createFileRoute } from '@tanstack/solid-router'

import { sql } from '../../server/db'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await sql`select 1`
          return Response.json({ status: 'ok' })
        } catch {
          return Response.json({ status: 'database unreachable' }, { status: 503 })
        }
      },
    },
  },
})
