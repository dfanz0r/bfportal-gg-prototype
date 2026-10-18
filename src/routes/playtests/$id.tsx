import { createFileRoute, notFound } from '@tanstack/solid-router'

import { PlaytestPage, playtestHead } from '../../components/playtest-page'
import { fetchPlaytest } from '../../functions/playtests'

export const Route = createFileRoute('/playtests/$id')({
  loader: async ({ params }) => {
    // Only an approved playtest is there for the public.
    const playtest = /^\d{1,9}$/.test(params.id)
      ? await fetchPlaytest({ data: { id: Number(params.id) } })
      : null
    if (!playtest) {
      throw notFound()
    }
    return playtest
  },
  head: ({ loaderData }) => playtestHead(loaderData),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <PlaytestPage data={data()} />
}
