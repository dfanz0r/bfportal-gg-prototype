import { createFileRoute, notFound } from '@tanstack/solid-router'

import { AdminReview } from '../../components/admin-review'
import { fetchSubmissionReview } from '../../functions/moderation'
import { pageTitle } from '../../shared/page-title'

export const Route = createFileRoute('/admin/review/$id')({
  loader: async ({ params }) => {
    const review = /^\d{1,9}$/.test(params.id)
      ? await fetchSubmissionReview({ data: { id: Number(params.id) } })
      : null
    // Decided already, or never there.
    if (!review?.ok) {
      throw notFound()
    }
    return review
  },
  head: () => pageTitle('Review a submission'),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <AdminReview data={data()} />
}
