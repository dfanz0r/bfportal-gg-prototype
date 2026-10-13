import { describe, expect, it } from 'vitest'

import { mapDiscordProfile, placeholderEmail } from './discord-profile'

describe('mapDiscordProfile', () => {
  it('maps the Discord id and username', () => {
    const mapped = mapDiscordProfile({
      id: '236802771381125120',
      username: 'recruit',
    })

    expect(mapped).toMatchObject({
      discordId: '236802771381125120',
      discordUsername: 'recruit',
    })
  })

  it('stores a placeholder derived from the id, never a real email', () => {
    // Discord sends no email without the `email` scope, but a profile that
    // carries one must not leak into the user row either.
    const mapped = mapDiscordProfile({
      id: '338947895665360898',
      username: 'recruit',
      email: 'recruit@example.com',
      verified: true,
    } as Parameters<typeof mapDiscordProfile>[0])

    expect(mapped.email).toBe('338947895665360898@discord.invalid')
    expect(mapped.email).toBe(placeholderEmail('338947895665360898'))
    expect(mapped.emailVerified).toBe(false)
  })
})
