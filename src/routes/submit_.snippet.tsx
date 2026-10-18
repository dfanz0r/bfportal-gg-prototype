import { createFileRoute, redirect } from '@tanstack/solid-router'
import { z } from 'zod'

import { SnippetSubmitPage } from '../components/snippet-submit-page'
import { fetchSnippetSubmitPage } from '../functions/submit-snippet'
import { pageTitle } from '../shared/page-title'

const searchSchema = z.object({
  // Set when a form posted without script was refused: the page comes back
  // with what was sent and what was wrong with it.
  draft: z.literal(true).optional().catch(undefined),
})

export const Route = createFileRoute('/submit_/snippet')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ draft: search.draft }),
  loader: async ({ deps }) => {
    const page = await fetchSnippetSubmitPage({ data: deps })
    // Submitting is for people who are signed in.
    if (page.state === 'login') {
      throw redirect({ href: '/login' })
    }
    return page
  },
  head: () => ({
    meta: [
      ...pageTitle('Submit a snippet').meta,
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <SnippetSubmitPage data={data()} />
}
