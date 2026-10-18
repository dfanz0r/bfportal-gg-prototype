import { createFileRoute, notFound } from '@tanstack/solid-router'

import {
  SnippetPage,
  snippetHead,
} from '../../components/snippets/snippet-page'
import { fetchSnippet } from '../../functions/snippets'
import { decisionSearchSchema } from '../../shared/decision'

export const Route = createFileRoute('/snippets/$slug')({
  // A waiting snippet is decided on its own page. Set when a decision posted
  // with no script was refused.
  validateSearch: decisionSearchSchema,
  loader: async ({ params }) => {
    const snippet = await fetchSnippet({ data: { slug: params.slug } })
    if (!snippet) {
      throw notFound()
    }
    return snippet
  },
  head: ({ loaderData }) => snippetHead(loaderData),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  return <SnippetPage data={data()} decision={search()} />
}
