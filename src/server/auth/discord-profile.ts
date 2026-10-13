/** The part of Discord's user object that the site reads. */
export interface DiscordProfile {
  id: string
  username: string
}

/**
 * Better Auth needs a unique email per user, but the site never uses one, so
 * it does not ask Discord for it. Every user gets this address instead, and
 * the legacy import uses the same one.
 *
 * If the site ever needs to reach its users, request Discord's `email` scope
 * again and store the real address here. See "Open decisions" in PLAN.md.
 */
export function placeholderEmail(discordId: string) {
  return `${discordId}@discord.invalid`
}

export function mapDiscordProfile(profile: DiscordProfile) {
  return {
    email: placeholderEmail(profile.id),
    emailVerified: false,
    discordId: profile.id,
    discordUsername: profile.username,
  }
}
