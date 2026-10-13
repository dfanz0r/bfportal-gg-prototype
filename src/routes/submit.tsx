import { createFileRoute, redirect } from '@tanstack/solid-router'
import { z } from 'zod'

import { SubmitPage } from '../components/submit-page'
import { fetchSubmitPage } from '../functions/submit'
import { games } from '../shared/content'
import { pageTitle } from '../shared/page-title'

/** The router reads "1264" as a number; a code is always text. */
const text = (max: number) =>
  z
    .preprocess((value) => String(value ?? ''), z.string().max(max))
    .optional()
    .catch(undefined)

const searchSchema = z.object({
  game: z.enum(games).optional().catch(undefined),
  code: text(20),
  link: text(500),
  // What was wrong, when a form posted without script was refused.
  error: text(300),
})

export const Route = createFileRoute('/submit')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    game: search.game,
    code: search.code || undefined,
    link: search.link || undefined,
  }),
  loader: async ({ deps }) => {
    const page = await fetchSubmitPage({ data: deps })
    // Submitting is for people who are signed in.
    if (page.state === 'login') {
      throw redirect({ href: '/login' })
    }
    return page
  },
  head: () => ({
    meta: [
      ...pageTitle('Submit an experience').meta,
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  return <SubmitPage data={data()} error={search().error} />
}
