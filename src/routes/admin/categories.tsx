import { createFileRoute, notFound } from '@tanstack/solid-router'

import { AdminCategories } from '../../components/admin-categories'
import { fetchTaxonomy } from '../../functions/admin-taxonomy'
import { taxonomySearchSchema } from '../../shared/admin-search'
import { pageTitle } from '../../shared/page-title'

export const Route = createFileRoute('/admin/categories')({
  validateSearch: taxonomySearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const taxonomy = await fetchTaxonomy({ data: deps })
    if (!taxonomy.ok) {
      throw notFound()
    }
    return taxonomy
  },
  head: () => pageTitle('Categories and tags'),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  return <AdminCategories data={data()} />
}
