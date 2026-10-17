import { createFileRoute, notFound } from '@tanstack/solid-router'

import { FilePage } from '../../components/file-page'
import { fetchFileView } from '../../functions/files'
import { pageTitle } from '../../shared/page-title'

// One project file, read on a page. Who may see it is who may download it.
export const Route = createFileRoute('/files/$id')({
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
  return <FilePage data={data()} />
}
