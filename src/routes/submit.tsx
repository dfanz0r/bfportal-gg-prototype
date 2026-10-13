import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/submit')({
  head: () => pageTitle('Submit an experience'),
  component: SubmitPage,
})

function SubmitPage() {
  return (
    <SectionPlaceholder
      title="Submit an experience"
      lead="Share something you built with the community."
    />
  )
}
