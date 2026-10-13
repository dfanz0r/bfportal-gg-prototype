import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/section-placeholder'

export const Route = createFileRoute('/tools')({
  head: () => ({ meta: [{ title: 'Tools and plugins · bfportal.gg' }] }),
  component: ToolsPage,
})

function ToolsPage() {
  return (
    <SectionPlaceholder
      title="Tools and plugins"
      lead="Editor plugins, command-line tools and add-ons that make building for Portal easier."
      planned={[
        'A page per tool with install steps and a link to its repository.',
        'Update posts, the same as experiences and scripts have.',
        'A label for tools that are still in progress.',
      ]}
    />
  )
}
