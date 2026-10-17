import { createFileRoute, notFound } from '@tanstack/solid-router'

import { ScriptPage, scriptHead } from '../../components/script-page'
import { fetchScript } from '../../functions/scripts'
import { decisionSearchSchema } from '../../shared/decision'

export const Route = createFileRoute('/scripts/$slug')({
  // A waiting snippet is decided on its own page. Set when a decision posted
  // with no script was refused.
  validateSearch: decisionSearchSchema,
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
  const search = Route.useSearch()
  return <ScriptPage data={data()} decision={search()} />
}
