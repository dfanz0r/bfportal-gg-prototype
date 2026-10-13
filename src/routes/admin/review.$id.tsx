import { createFileRoute, notFound } from '@tanstack/solid-router'
import { z } from 'zod'

import { AdminReview } from '../../components/admin-review'
import { fetchSubmissionReview } from '../../functions/moderation'
import { pageTitle } from '../../shared/page-title'

const searchSchema = z.object({
  // Set when a decision posted with no script was refused, naming what was
  // wrong. The page has the words for it.
  problem: z.literal('note').optional().catch(undefined),
})

export const Route = createFileRoute('/admin/review/$id')({
  validateSearch: searchSchema,
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
  const search = Route.useSearch()
  return <AdminReview data={data()} problem={search().problem} />
}
