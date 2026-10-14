import { createFileRoute, notFound } from '@tanstack/solid-router'

import {
  ExperiencePage,
  experienceHead,
} from '../../components/experience-page'
import { fetchExperience } from '../../functions/experience'

export const Route = createFileRoute('/experiences/$slug')({
  loader: async ({ params }) => {
    const experience = await fetchExperience({ data: { slug: params.slug } })
    // Only a published experience is there for the public. A draft, one in
    // review, sent back or removed, and a deleted one are not.
    if (!experience) {
      throw notFound()
    }
    return experience
  },
  head: ({ loaderData }) => experienceHead(loaderData),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <ExperiencePage data={data()} />
}
