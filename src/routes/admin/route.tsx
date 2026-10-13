import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from '@tanstack/solid-router'

import { getSessionUser } from '../../functions/session'
import { isStaff } from '../../shared/roles'

// Everything under /admin. The guard keeps these pages away from everyone
// else, and that is all it does: each server function behind a screen checks
// the role again, in its service.
export const Route = createFileRoute('/admin')({
  // The guard and the data run on the server, so a refused request gets a
  // real answer; the screens themselves are drawn in the browser.
  ssr: 'data-only',
  beforeLoad: async () => {
    const user = await getSessionUser()
    if (!user) {
      throw redirect({ href: '/login' })
    }
    if (!isStaff(user.role)) {
      throw notFound()
    }
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }] }),
  component: Outlet,
})
