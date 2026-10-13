import { createFileRoute } from '@tanstack/solid-router'

import { LibraryPage, libraryHead } from '../../components/library-page'
import { fetchLibrary } from '../../functions/library'
import { defaultGame } from '../../shared/games'
import { readLibraryAddress } from '../../shared/library-search'

// The first game's tab, at the Library's bare address.
export const Route = createFileRoute('/library/')({
  validateSearch: readLibraryAddress,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ deps }) =>
    fetchLibrary({ data: { game: defaultGame.id, search: deps.search } }),
  head: ({ loaderData }) => libraryHead(loaderData),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <LibraryPage data={data()} />
}
