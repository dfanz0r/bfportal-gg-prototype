import { createFileRoute } from '@tanstack/solid-router'

import { PlaytestList, playtestListHead } from '../../components/playtest-list'
import { fetchPlaytests } from '../../functions/playtests'

export const Route = createFileRoute('/playtests/')({
  loader: () => fetchPlaytests(),
  head: () => playtestListHead(),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <PlaytestList data={data()} />
}
