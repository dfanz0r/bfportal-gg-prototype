import { createFileRoute, getRouteApi } from '@tanstack/solid-router'
import { Show } from 'solid-js'

export const Route = createFileRoute('/')({ component: Home })

const rootRoute = getRouteApi('__root__')

function Home() {
  const user = rootRoute.useLoaderData()

  return (
    <main class="p-8">
      <h1 class="text-4xl font-bold">bfportal.gg</h1>
      <Show
        when={user()}
        fallback={
          <p class="mt-4 text-lg">
            <a href="/login" class="underline">
              Sign in with Discord
            </a>
          </p>
        }
      >
        {(signedIn) => (
          <form method="post" action="/logout" class="mt-4 text-lg">
            Signed in as {signedIn().name}.{' '}
            <button type="submit" class="underline">
              Sign out
            </button>
          </form>
        )}
      </Show>
    </main>
  )
}
