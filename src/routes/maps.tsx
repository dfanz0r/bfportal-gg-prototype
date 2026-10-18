import { createFileRoute } from '@tanstack/solid-router'

import { SectionPlaceholder } from '../components/layout/section-placeholder'
import { pageTitle } from '../shared/page-title'

export const Route = createFileRoute('/maps')({
  head: () => pageTitle('Maps'),
  component: MapsPage,
})

function MapsPage() {
  return (
    <SectionPlaceholder
      title="Maps"
      lead="Custom maps made in the spatial editor, with downloads and the experiences that use them."
      planned={[
        'A page per map with screenshots, size and the base map it was built on.',
        'A download of the spatial editor file.',
        'Links to every experience that uses the map.',
      ]}
    />
  )
}
