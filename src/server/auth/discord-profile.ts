/** The part of Discord's user object that the site reads. */
export interface DiscordProfile {
  id: string
  username: string
  email?: string | null
  verified?: boolean
}

/**
 * Better Auth needs a unique email per user, and Discord accounts registered
 * with a phone number have none. Those users get this address instead; users
 * with an email keep theirs. The legacy import uses the same address for old
 * users without an email.
 *
 * The site does not use the email for anything yet. Requiring a real one is
 * an open decision: see "Account email" in PLAN.md.
 */
export function placeholderEmail(discordId: string) {
  return `${discordId}@discord.invalid`
}

export function mapDiscordProfile(profile: DiscordProfile) {
  return {
    email: profile.email || placeholderEmail(profile.id),
    emailVerified: profile.email ? Boolean(profile.verified) : false,
    discordId: profile.id,
    discordUsername: profile.username,
  }
}
