import {
  type AdminStatus,
  adminStatuses,
  searchHref,
} from '../../shared/admin-search'
import { contentStatusLabels } from '../../shared/content'
import { Tabs } from './tabs'

/**
 * An admin list's tabs by status, each counted over the other filters, and
 * each keeping them.
 */
export function StatusTabs(props: {
  path: string
  search: Record<string, string | number | boolean | undefined> & {
    status?: AdminStatus
  }
  counts: Record<AdminStatus | 'all', number>
}) {
  const href = (status?: AdminStatus) =>
    searchHref(props.path, { ...props.search, status, page: undefined })
  return (
    <Tabs
      label="States"
      items={[
        {
          name: 'All',
          href: href(),
          count: props.counts.all,
          current: !props.search.status,
        },
        ...adminStatuses.map((status) => ({
          name: contentStatusLabels[status],
          href: href(status),
          count: props.counts[status],
          current: props.search.status === status,
        })),
      ]}
    />
  )
}
