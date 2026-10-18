// The admin's side menu, in its groups. The menu and the screens' guards read
// this, so each screen is named, and said to be admins' only, in one place.

/** What a menu entry counts beside its name, from the menu's own data. */
export type AdminCount = 'waiting' | 'reports'

export type AdminEntry = {
  label: string
  /** Its address. None for a screen that is not built yet. */
  to?: string
  /** Only admins may use it; moderators see it, marked so. */
  adminsOnly?: boolean
  count?: AdminCount
  /** Other addresses that belong to it, marking it current there too. */
  also?: string[]
}

export const adminMenu: { group: string; entries: AdminEntry[] }[] = [
  {
    group: 'Moderation',
    entries: [
      {
        label: 'Review queue',
        to: '/admin',
        count: 'waiting',
        also: ['/admin/review/', '/admin/edits/'],
      },
      { label: 'Reports', to: '/admin/reports', count: 'reports' },
    ],
  },
  {
    group: 'Content',
    entries: [
      { label: 'Experiences', to: '/admin/experiences' },
      { label: 'Snippets', to: '/admin/snippets' },
      { label: 'Update posts' },
      { label: 'Playtests' },
    ],
  },
  {
    group: 'Site',
    entries: [
      { label: 'Events and banners' },
      {
        label: 'Categories and tags',
        to: '/admin/categories',
        adminsOnly: true,
      },
      { label: 'Users and roles', to: '/admin/users', adminsOnly: true },
      { label: 'Settings', adminsOnly: true },
    ],
  },
]
