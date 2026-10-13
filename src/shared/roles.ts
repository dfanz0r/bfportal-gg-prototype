export const roles = ['user', 'moderator', 'admin'] as const

export type Role = (typeof roles)[number]

/** Reads a stored role, falling back to the least privileged one. */
export function parseRole(value: unknown): Role {
  return roles.find((role) => role === value) ?? 'user'
}
