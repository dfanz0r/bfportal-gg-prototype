import { defineConfig } from 'drizzle-kit'

import { loadLocalEnv } from './src/server/local-env.ts'

// Migrations need the database URL and nothing else, so this does not go
// through src/server/env.ts, which also requires the auth configuration.
loadLocalEnv()

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  dbCredentials: { url },
})
