import { createFileRoute, notFound, redirect } from '@tanstack/solid-router'

import { LibraryPage, libraryHead } from '../../components/library-page'
import { fetchLibrary } from '../../functions/library'
import { defaultGame, gameFromSlug } from '../../shared/games'
import { readLibraryAddress } from '../../shared/library-search'

// Every other game's tab: /library/bf2042.
export const Route = createFileRoute('/library/$game')({
  validateSearch: readLibraryAddress,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ params, deps }) => {
    const game = gameFromSlug(params.game)
    if (!game) {
      throw notFound()
    }
    // The first game lives at the bare address, and only there.
    if (game.id === defaultGame.id) {
      throw redirect({
        to: '/library',
        search: deps.search,
        statusCode: 301,
      })
    }
    return fetchLibrary({ data: { game: game.id, search: deps.search } })
  },
  head: ({ loaderData }) => libraryHead(loaderData),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <LibraryPage data={data()} />
}
