import { createFileRoute } from '@tanstack/solid-router'

import { currentActor } from '../../../server/auth/actor'
import { getProjectFile } from '../../../server/services/experience'

const notFound = () => new Response('Not found', { status: 404 })

// A file shared with a template. Always a download, never a page: these are
// files other people uploaded.
export const Route = createFileRoute('/api/files/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^\d{1,9}$/.test(params.id)) return notFound()
        const file = await getProjectFile(
          Number(params.id),
          await currentActor(),
        )
        if (!file) return notFound()

        const filename = file.filename.replace(/[^\w.-]+/g, '_')
        return new Response(file.body, {
          headers: {
            'Content-Type': filename.endsWith('.json')
              ? 'application/json; charset=utf-8'
              : 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
