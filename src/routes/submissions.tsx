import { createFileRoute, redirect } from '@tanstack/solid-router'

import { YourSubmissions } from '../components/your-submissions'
import { fetchOwnSubmissions } from '../functions/submissions'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/submissions')({
  loader: async () => {
    const page = await fetchOwnSubmissions()
    // A list of someone's own, for them alone.
    if (!page.ok) throw redirect({ href: '/login' })
    return page
  },
  head: () => ({
    meta: [
      ...pageTitle('Your submissions').meta,
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <YourSubmissions data={data()} />
}
