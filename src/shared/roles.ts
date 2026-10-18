export const roles = ['user', 'moderator', 'admin'] as const

export type Role = (typeof roles)[number]

/** How the site names each role. */
export const roleLabels: Record<Role, string> = {
  user: 'User',
  moderator: 'Moderator',
  admin: 'Admin',
}

/** Whether a role may review what users submit. */
export function isStaff(role: Role) {
  return role === 'moderator' || role === 'admin'
}

/** Whether a role runs the site: its people, its categories and tags. */
export function isAdmin(role: Role) {
  return role === 'admin'
}

/** Reads a stored role, falling back to the least privileged one. */
export function parseRole(value: unknown): Role {
  return roles.find((role) => role === value) ?? 'user'
}
