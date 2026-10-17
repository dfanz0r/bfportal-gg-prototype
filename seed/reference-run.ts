import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '../src/server/db/schema'
import { loadLocalEnv } from '../src/server/local-env'
import { loadReference } from './load-reference'

// `pnpm db:reference`. Adds the reference rows a database is missing, and
// nothing else, so unlike the seed it is safe on a server: the production
// image runs it after the migrations. Needs the database URL alone, so it
// does not go through src/server/env.ts.
loadLocalEnv()

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set')
}

const sql = postgres(url, { max: 1, onnotice: () => {} })
try {
  const db = drizzle(sql, { schema })
  const loaded = await db.transaction((tx) => loadReference(tx))
  console.log('Reference rows:', {
    categories: loaded.categoryRows.length,
    sdkReleases: loaded.sdkRows.length,
    tagGroups: loaded.groupRows.length,
    tags: loaded.tagRows.length,
    maps: loaded.mapRows.length,
  })
} finally {
  await sql.end()
}
