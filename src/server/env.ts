import { z } from 'zod'

import { loadLocalEnv } from './local-env'

loadLocalEnv()

const isProduction = process.env.NODE_ENV === 'production'

// Login cannot work without the Discord application, so production refuses to
// start without it. Development can run without one; signing in then fails
// with "provider not found".
const discordCredential = isProduction
  ? z.string().min(1)
  : z.string().min(1).optional()

const schema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
  // The address the public reaches the site at, for canonical links and
  // previews. Defaults to the sign-in address, which is the same one unless
  // sign-in is ever hosted apart.
  SITE_URL: z.url({ protocol: /^https?$/ }).optional(),
  BETTER_AUTH_SECRET: z.string().min(32),
  DISCORD_CLIENT_ID: discordCredential,
  DISCORD_CLIENT_SECRET: discordCredential,
})

// A variable left blank in an env file arrives as an empty string.
const defined = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== ''),
)

const parsed = schema.safeParse(defined)
if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration:\n${z.prettifyError(parsed.error)}`,
  )
}

export const env = parsed.data

/** The site's public address, with no slash on the end. */
export const siteUrl = (env.SITE_URL ?? env.BETTER_AUTH_URL).replace(/\/+$/, '')
