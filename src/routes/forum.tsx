import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/layout/section-placeholder'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/forum')({
  head: () => pageTitle('Forum'),
  component: ForumPage,
})

function ForumPage() {
  return (
    <SectionPlaceholder
      title="Forum"
      lead="Questions, showcases and feedback threads."
      planned={[
        'Threads by topic, with unanswered questions easy to find.',
        'A feedback thread linked from each project page.',
        'Sign-in with the same Discord account.',
      ]}
    />
  )
}
