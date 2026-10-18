import { createFileRoute } from '@tanstack/solid-router'

import { SnippetList, snippetListHead } from '../../components/snippet-list'
import { fetchSnippets } from '../../functions/snippets'
import { snippetsSearchSchema } from '../../shared/feed-search'

export const Route = createFileRoute('/snippets/')({
  validateSearch: snippetsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchSnippets({ data: deps }),
  head: () => snippetListHead(),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <SnippetList data={data()} />
}
