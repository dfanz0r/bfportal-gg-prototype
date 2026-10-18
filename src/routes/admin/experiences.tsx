import { createFileRoute, getRouteApi, notFound } from '@tanstack/solid-router'

import { AdminExperiences } from '../../components/admin-experiences'
import { fetchAdminExperiences } from '../../functions/admin-content'
import { adminExperiencesSearchSchema } from '../../shared/admin-search'
import { pageTitle } from '../../shared/page-title'
import { isAdmin } from '../../shared/roles'

const admin = getRouteApi('/admin')

export const Route = createFileRoute('/admin/experiences')({
  validateSearch: adminExperiencesSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const list = await fetchAdminExperiences({ data: deps })
    if (!list.ok) {
      throw notFound()
    }
    return list
  },
  head: () => pageTitle('Experiences'),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const menu = admin.useLoaderData()
  return (
    <AdminExperiences
      data={data()}
      search={search()}
      isAdmin={isAdmin(menu().role)}
    />
  )
}
