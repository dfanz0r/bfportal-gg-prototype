import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'

export const Route = createFileRoute('/library')({
  head: () => ({ meta: [{ title: 'Experience library · bfportal.gg' }] }),
  component: LibraryPage,
})

function LibraryPage() {
  return (
    <SectionPlaceholder
      title="Experience library"
      lead="Every experience shared with the community, for Battlefield 6 and Battlefield 2042."
    />
  )
}
