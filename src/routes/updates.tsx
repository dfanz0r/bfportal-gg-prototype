import { createFileRoute } from '@tanstack/solid-router'

import { UpdateList, updateListHead } from '../components/update-list'
import { fetchUpdates } from '../functions/updates'
import { updatesSearchSchema } from '../shared/feed-search'

export const Route = createFileRoute('/updates')({
  validateSearch: updatesSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchUpdates({ data: deps }),
  head: () => updateListHead(),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <UpdateList data={data()} />
}
