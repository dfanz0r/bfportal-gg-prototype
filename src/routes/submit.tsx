import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'

export const Route = createFileRoute('/submit')({
  head: () => ({ meta: [{ title: 'Submit an experience · bfportal.gg' }] }),
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
