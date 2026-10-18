import { createFileRoute, notFound, redirect } from '@tanstack/solid-router'

import { ProfilePage, profileHead } from '../../components/profile-page'
import { fetchProfile } from '../../functions/profile'
import { profileSearchSchema } from '../../shared/feed-search'

export const Route = createFileRoute('/users/$discordId')({
  validateSearch: profileSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const found = /^\d{1,25}$/.test(params.discordId)
      ? await fetchProfile({
          data: { discordId: params.discordId, tab: deps.tab, page: deps.page },
        })
      : null
    if (!found) {
      throw notFound()
    }
    // The site can keep profiles for signed-in visitors only.
    if (found.state === 'login') {
      throw redirect({ href: '/login' })
    }
    return found.profile
  },
  head: ({ loaderData }) => profileHead(loaderData),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <ProfilePage data={data()} />
}
