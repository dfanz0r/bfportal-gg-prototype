import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../src/server/db/schema'
import { isLocalHost, loadLocalEnv } from '../src/server/local-env'
import { seed } from './seed'

// `pnpm db:seed`. Needs the database URL and nothing else, so this does not go
// through src/server/env.ts, which also requires the auth configuration.
loadLocalEnv()

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set')
}
// The seed empties every content table. It only ever runs against a database
// on this machine.
if (
  process.env.NODE_ENV === 'production' ||
  !isLocalHost(new URL(url).hostname)
) {
  throw new Error('Refusing to seed: this is not a local development database')
}

const sql = postgres(url, { max: 1, onnotice: () => {} })
try {
  const counts = await seed(drizzle(sql, { schema }))
  console.log('Seeded:', counts)
} finally {
  await sql.end()
}
