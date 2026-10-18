import { createFileRoute, notFound } from '@tanstack/solid-router'

import { AdminQueue } from '../../components/admin/admin-queue'
import { fetchQueue } from '../../functions/moderation'
import { pageTitle } from '../../shared/page-title'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    const queue = await fetchQueue()
    if (!queue.ok) {
      throw notFound()
    }
    return queue
  },
  head: () => pageTitle('Review queue'),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <AdminQueue data={data()} />
}
