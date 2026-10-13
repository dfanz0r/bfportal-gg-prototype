export const roles = ['user', 'moderator', 'admin'] as const

export type Role = (typeof roles)[number]

/** Whether a role may review what users submit. */
export function isStaff(role: Role) {
  return role === 'moderator' || role === 'admin'
}

/** Reads a stored role, falling back to the least privileged one. */
export function parseRole(value: unknown): Role {
  return roles.find((role) => role === value) ?? 'user'
}
