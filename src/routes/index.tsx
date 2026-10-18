import { createFileRoute } from '@tanstack/solid-router'

import { HomePage } from '../components/home/home-page'
import { fetchHome } from '../functions/home'

const DESCRIPTION =
  'Experiences, snippets, maps and tools made by the Battlefield Portal community. Find something to play tonight, or share what you have built.'

export const Route = createFileRoute('/')({
  loader: () => fetchHome(),
  head: () => ({
    meta: [
      { title: 'bfportal.gg · The Battlefield Portal creator hub' },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: 'bfportal.gg' },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:type', content: 'website' },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <HomePage data={data()} />
}
