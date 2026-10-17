import { createFileRoute, notFound } from '@tanstack/solid-router'
import { z } from 'zod'

import { FilePage } from '../../components/file-page'
import { fetchFileView } from '../../functions/files'
import { pageTitle } from '../../shared/page-title'

// One project file, read on a page. Who may see it is who may download it.
export const Route = createFileRoute('/files/$id')({
  // The page it was opened from, such as a review screen, to go back to.
  validateSearch: z.object({
    back: z.string().max(300).optional().catch(undefined),
  }),
  loader: async ({ params }) => {
    const view = /^\d{1,9}$/.test(params.id)
      ? await fetchFileView({ data: { id: Number(params.id) } })
      : null
    if (!view) throw notFound()
    return view
  },
  head: ({ loaderData }) => ({
    meta: [
      ...pageTitle(loaderData?.file.filename ?? 'A file').meta,
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  return <FilePage data={data()} back={search().back} />
}
