import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start/solid'

import { db } from '../db'
import * as schema from '../db/schema'
import { env } from '../env'
import { mapDiscordProfile } from './discord-profile'

const discord =
  env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET
    ? {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
        // Ask for the profile only, not the email. See discord-profile.ts.
        disableDefaultScope: true,
        scope: ['identify'],
        mapProfileToUser: mapDiscordProfile,
        // Refresh the name, avatar and Discord username on every sign-in.
        overrideUserInfoOnSignIn: true,
      }
    : undefined

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  // Discord is the only way to sign in.
  socialProviders: discord ? { discord } : {},
  // Profile data comes from Discord. With this endpoint open, a signed-in user
  // could overwrite the fields below that Better Auth accepts as input.
  disabledPaths: ['/update-user'],
  user: {
    additionalFields: {
      // Filled from the Discord profile. Better Auth drops provider values for
      // fields marked `input: false`, so these two cannot be.
      discordId: { type: 'string', required: true, unique: true },
      discordUsername: { type: 'string', required: true },
      // Only server code writes the rest.
      role: {
        type: 'string',
        required: true,
        defaultValue: 'user',
        input: false,
      },
      hideUsername: {
        type: 'boolean',
        required: true,
        defaultValue: false,
        input: false,
      },
      legacyId: { type: 'number', required: false, input: false },
    },
  },
  plugins: [tanstackStartCookies()],
})
