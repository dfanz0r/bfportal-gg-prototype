import { eq, sql as raw } from 'drizzle-orm'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { db, sql } from '../db'
import { account, user } from '../db/schema'
import { auth } from '.'

const BASE_URL = 'http://localhost:3000'

interface FakeDiscordUser {
  id: string
  username: string
  global_name: string | null
  avatar: string | null
  discriminator: string
  email: string | null
  verified: boolean
}

function discordUser(
  overrides: Partial<FakeDiscordUser> = {},
): FakeDiscordUser {
  return {
    id: '236802771381125120',
    username: 'recruit',
    global_name: 'Recruit',
    avatar: 'a1b2c3',
    discriminator: '0',
    email: 'recruit@example.com',
    verified: true,
    ...overrides,
  }
}

/** Stands in for Discord's token and profile endpoints. */
function stubDiscord(profile: FakeDiscordUser) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    // The client percent-encodes the "@" in /users/@me.
    const path = decodeURIComponent(url.pathname)
    if (url.host === 'discord.com' && path === '/api/oauth2/token') {
      return Response.json({
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        scope: 'identify email',
      })
    }
    if (url.host === 'discord.com' && path === '/api/users/@me') {
      return Response.json(profile)
    }
    throw new Error(`Unexpected request to ${url}`)
  })
}

function cookieHeader(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

/** Runs the whole OAuth round trip and returns the session cookie. */
async function signIn(profile: FakeDiscordUser) {
  stubDiscord(profile)

  const start = await auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/social`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE_URL },
      body: JSON.stringify({ provider: 'discord', callbackURL: '/' }),
    }),
  )
  expect(start.status).toBe(200)
  const { url } = (await start.json()) as { url: string }
  const authorizeUrl = new URL(url)
  expect(authorizeUrl.searchParams.get('scope')).toBe('identify email')
  const state = authorizeUrl.searchParams.get('state')

  const callback = await auth.handler(
    new Request(
      `${BASE_URL}/api/auth/callback/discord?code=test-code&state=${state}`,
      { headers: { cookie: cookieHeader(start) } },
    ),
  )
  expect(callback.status).toBe(302)
  expect(callback.headers.get('location')).toBe('/')
  return cookieHeader(callback)
}

async function storedUser(discordId: string) {
  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.discordId, discordId))
  return row
}

describe('signing in with Discord', () => {
  beforeEach(async () => {
    // Other test files leave rows that reference users.
    await db.execute(raw`truncate ${user} cascade`)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  afterAll(async () => {
    await sql.end()
  })

  it('creates the user with the Discord id, username and default role', async () => {
    await signIn(discordUser())

    const row = await storedUser('236802771381125120')
    expect(row).toMatchObject({
      name: 'Recruit',
      email: 'recruit@example.com',
      emailVerified: true,
      image: 'https://cdn.discordapp.com/avatars/236802771381125120/a1b2c3.png',
      discordId: '236802771381125120',
      discordUsername: 'recruit',
      role: 'user',
      hideUsername: false,
      legacyId: null,
    })

    const accounts = await db
      .select()
      .from(account)
      .where(eq(account.userId, row.id))
    expect(accounts).toMatchObject([
      { providerId: 'discord', accountId: '236802771381125120' },
    ])
  })

  it('accepts a Discord account that has no email', async () => {
    await signIn(
      discordUser({ id: '338947895665360898', email: null, verified: false }),
    )

    const row = await storedUser('338947895665360898')
    expect(row).toMatchObject({
      email: '338947895665360898@discord.invalid',
      emailVerified: false,
    })
  })

  it('refreshes the profile on the next sign-in and keeps the role', async () => {
    await signIn(discordUser())
    await db
      .update(user)
      .set({ role: 'moderator', hideUsername: true })
      .where(eq(user.discordId, '236802771381125120'))

    await signIn(
      discordUser({
        username: 'veteran',
        global_name: 'Veteran',
        avatar: 'd4e5f6',
      }),
    )

    expect(await db.select().from(user)).toHaveLength(1)
    expect(await storedUser('236802771381125120')).toMatchObject({
      name: 'Veteran',
      image: 'https://cdn.discordapp.com/avatars/236802771381125120/d4e5f6.png',
      discordUsername: 'veteran',
      role: 'moderator',
      hideUsername: true,
    })
  })

  it('does not let a signed-in user rewrite their own profile fields', async () => {
    const cookie = await signIn(discordUser())

    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth/update-user`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: BASE_URL,
          cookie,
        },
        body: JSON.stringify({ discordId: '1', role: 'admin' }),
      }),
    )

    expect(response.status).toBe(404)
    expect(await storedUser('236802771381125120')).toMatchObject({
      discordId: '236802771381125120',
      role: 'user',
    })
  })
})
