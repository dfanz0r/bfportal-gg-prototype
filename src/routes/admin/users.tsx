import { createFileRoute, notFound } from '@tanstack/solid-router'

import { AdminUsers } from '../../components/admin-users'
import { fetchUsers } from '../../functions/admin-users'
import { usersSearchSchema } from '../../shared/admin-search'
import { pageTitle } from '../../shared/page-title'

export const Route = createFileRoute('/admin/users')({
  validateSearch: usersSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const users = await fetchUsers({ data: deps })
    if (!users.ok) {
      throw notFound()
    }
    return users
  },
  head: () => pageTitle('Users and roles'),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  return <AdminUsers data={data()} search={search()} />
}
