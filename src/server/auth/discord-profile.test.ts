import { describe, expect, it } from 'vitest'

import { mapDiscordProfile, placeholderEmail } from './discord-profile'

describe('mapDiscordProfile', () => {
  it('keeps the email Discord returns', () => {
    const mapped = mapDiscordProfile({
      id: '236802771381125120',
      username: 'recruit',
      email: 'recruit@example.com',
      verified: true,
    })

    expect(mapped).toEqual({
      email: 'recruit@example.com',
      emailVerified: true,
      discordId: '236802771381125120',
      discordUsername: 'recruit',
    })
  })

  it('gives an account without an email a placeholder derived from its id', () => {
    const mapped = mapDiscordProfile({
      id: '338947895665360898',
      username: 'phone-only',
      email: null,
      verified: false,
    })

    expect(mapped.email).toBe('338947895665360898@discord.invalid')
    expect(mapped.email).toBe(placeholderEmail('338947895665360898'))
    expect(mapped.emailVerified).toBe(false)
  })
})
