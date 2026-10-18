import { createFileRoute, notFound } from '@tanstack/solid-router'

import { AdminEdit } from '../../components/admin-edit'
import { fetchEditReview } from '../../functions/moderation'
import { decisionSearchSchema } from '../../shared/decision'
import { pageTitle } from '../../shared/page-title'

export const Route = createFileRoute('/admin/edits/$id')({
  // Set when a decision posted with no script was refused.
  validateSearch: decisionSearchSchema,
  loader: async ({ params }) => {
    const review = /^\d{1,9}$/.test(params.id)
      ? await fetchEditReview({ data: { id: Number(params.id) } })
      : null
    // Decided already, or never there.
    if (!review?.ok) {
      throw notFound()
    }
    return review
  },
  head: () => pageTitle('Review an edit'),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  return <AdminEdit data={data()} decision={search()} />
}
