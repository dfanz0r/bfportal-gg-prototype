import { createFileRoute, redirect } from '@tanstack/solid-router'

import { snippetsSearchSchema } from '../../shared/feed-search'

// The section's old address, from before it was named for what it lists.
export const Route = createFileRoute('/scripts/')({
  validateSearch: snippetsSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/snippets', search, statusCode: 301 })
  },
})
