import { createFileRoute, notFound, redirect } from '@tanstack/solid-router'
import { z } from 'zod'

import { SubmitPage } from '../../components/submit/submit-page'
import { fetchDraftEditPage } from '../../functions/submit'
import { pageTitle } from '../../shared/page-title'

/** The router reads "1264" as a number; a code is always text. */
const text = (max: number) =>
  z
    .preprocess((value) => String(value ?? ''), z.string().max(max))
    .optional()
    .catch(undefined)

const searchSchema = z.object({
  code: text(20),
  link: text(500),
  // Set when a form posted without script was refused, or its files were
  // read: the page comes back with what was sent.
  draft: z.literal(true).optional().catch(undefined),
})

// One of the visitor's experiences, opened in the submit form to go on with
// it: a draft, one sent back, one in review, or one that is live.
export const Route = createFileRoute('/experiences/$slug_/edit')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    code: search.code || undefined,
    link: search.link || undefined,
    draft: search.draft,
  }),
  loader: async ({ params, deps }) => {
    const page = await fetchDraftEditPage({
      data: { slug: params.slug, ...deps },
    })
    if (page.state === 'login') throw redirect({ href: '/login' })
    // Someone else's, submitted already, or deleted.
    if (page.state === 'not-found') throw notFound()
    return page
  },
  head: () => ({
    meta: [
      ...pageTitle('Edit an experience').meta,
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <SubmitPage data={data()} />
}
