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
  // The request header the proxy in front of the site puts the visitor's
  // address in, which limits per visitor go by. Only a header that proxy
  // sets itself can be trusted: behind Cloudflare that is cf-connecting-ip,
  // where x-forwarded-for keeps whatever the visitor sent ahead of it.
  CLIENT_IP_HEADER: z
    .string()
    .regex(/^[a-z0-9-]+$/i)
    .default('x-forwarded-for'),
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
// The default suits development, where nothing is in front of the site. In
// production the header is the proxy's to say, so it must be said.
if (defined.NODE_ENV === 'production' && !defined.CLIENT_IP_HEADER) {
  throw new Error(
    'Invalid environment configuration:\nCLIENT_IP_HEADER must be set in production: the header the proxy in front of the site puts the visitor’s address in, such as cf-connecting-ip.',
  )
}

export const env = parsed.data

/**
 * The visitor's address, as the proxy in front of the site says it, or null
 * where there is none, as in development. The first address in the header is
 * the one nearest the visitor.
 */
export function clientIp(request: Request) {
  const value = request.headers.get(env.CLIENT_IP_HEADER)
  return value?.split(',')[0]?.trim() || null
}

/** The site's public address, with no slash on the end. */
export const siteUrl = (env.SITE_URL ?? env.BETTER_AUTH_URL).replace(/\/+$/, '')
