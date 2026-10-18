import { createFileRoute, redirect } from '@tanstack/solid-router'

// A snippet's old address, from before the section was named for what it
// lists.
export const Route = createFileRoute('/scripts/$slug')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/snippets/$slug',
      params: { slug: params.slug },
      statusCode: 301,
    })
  },
})
