import { createFileRoute } from '@tanstack/solid-router'

import { currentActor } from '../../../server/auth/actor'
import { getProposedFile } from '../../../server/services/file-view'

const notFound = () => new Response('Not found', { status: 404 })

// A file an edit waiting for review would store, for the moderator deciding
// on it. Always a download, never a page: someone else uploaded it.
export const Route = createFileRoute('/api/edits/$id/files/$file')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^\d{1,9}$/.test(params.id)) return notFound()
        const found = await getProposedFile(
          await currentActor(),
          Number(params.id),
          params.file,
        )
        if (!found) return notFound()

        const filename = found.file.filename.replace(/[^\w.-]+/g, '_')
        return new Response(found.body, {
          headers: {
            'Content-Type': filename.endsWith('.json')
              ? 'application/json; charset=utf-8'
              : 'text/plain; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'X-Content-Type-Options': 'nosniff',
            // A moderator's copy of something not yet public.
            'Cache-Control': 'private, no-store',
          },
        })
      },
    },
  },
})
