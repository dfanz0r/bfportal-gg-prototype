import { createFileRoute, notFound } from '@tanstack/solid-router'

import { ScriptPage, scriptHead } from '../../components/script-page'
import { fetchScript } from '../../functions/scripts'

export const Route = createFileRoute('/scripts/$slug')({
  loader: async ({ params }) => {
    const script = await fetchScript({ data: { slug: params.slug } })
    if (!script) {
      throw notFound()
    }
    return script
  },
  head: ({ loaderData }) => scriptHead(loaderData),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <ScriptPage data={data()} />
}
