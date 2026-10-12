import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit runs outside Vite, so it does not see .env.local on its own.
if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  process.loadEnvFile('.env.local')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
