import { createFileRoute, notFound } from '@tanstack/solid-router'

import { AdminReports } from '../../components/admin-reports'
import { fetchReports } from '../../functions/admin-reports'
import { reportsSearchSchema } from '../../shared/admin-search'
import { pageTitle } from '../../shared/page-title'

export const Route = createFileRoute('/admin/reports')({
  validateSearch: reportsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const reports = await fetchReports({ data: deps })
    if (!reports.ok) {
      throw notFound()
    }
    return reports
  },
  head: () => pageTitle('Reports'),
  component: Page,
})

function Page() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  return <AdminReports data={data()} search={search()} />
}
