import { createFileRoute, getRouteApi, notFound } from '@tanstack/solid-router'

import { AdminSnippets } from '../../components/admin-snippets'
import { fetchAdminSnippets } from '../../functions/admin-content'
import { adminSnippetsSearchSchema } from '../../shared/admin-search'
import { pageTitle } from '../../shared/page-title'
import { isAdmin } from '../../shared/roles'

const admin = getRouteApi('/admin')

export const Route = createFileRoute('/admin/snippets')({
  validateSearch: adminSnippetsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const list = await fetchAdminSnippets({ data: deps })
    if (!list.ok) {
      throw notFound()
    }
    return list
  },
  head: () => pageTitle('Snippets'),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const menu = admin.useLoaderData()
  return (
    <AdminSnippets
      data={data()}
      search={search()}
      isAdmin={isAdmin(menu().role)}
    />
  )
}
