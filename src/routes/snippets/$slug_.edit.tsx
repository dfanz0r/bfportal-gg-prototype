import { createFileRoute, notFound, redirect } from '@tanstack/solid-router'
import { z } from 'zod'

import { SnippetSubmitPage } from '../../components/snippets/snippet-submit-page'
import { fetchSnippetEditPage } from '../../functions/submit-snippet'
import { pageTitle } from '../../shared/page-title'

const searchSchema = z.object({
  // Set when a form posted without script was refused: the page comes back
  // with what was sent and what was wrong with it.
  draft: z.literal(true).optional().catch(undefined),
})

// One of the visitor's snippets, in the snippet form to change and send.
export const Route = createFileRoute('/snippets/$slug_/edit')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ draft: search.draft }),
  loader: async ({ params, deps }) => {
    const page = await fetchSnippetEditPage({
      data: { slug: params.slug, ...deps },
    })
    if (page.state === 'login') throw redirect({ href: '/login' })
    // Someone else's, removed, or deleted.
    if (page.state === 'not-found') throw notFound()
    return page
  },
  head: () => ({
    meta: [
      ...pageTitle('Edit a snippet').meta,
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <SnippetSubmitPage data={data()} />
}
