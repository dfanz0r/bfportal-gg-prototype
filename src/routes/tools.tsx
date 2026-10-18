import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/layout/section-placeholder'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/tools')({
  head: () => pageTitle('Tools and plugins'),
  component: ToolsPage,
})

function ToolsPage() {
  return (
    <SectionPlaceholder
      title="Tools and plugins"
      lead="Editor plugins, command-line tools and add-ons that make building for Portal easier."
      planned={[
        'A page per tool with install steps and a link to its repository.',
        'Update posts, the same as experiences and snippets have.',
        'A label for tools that are still in progress.',
      ]}
    />
  )
}
