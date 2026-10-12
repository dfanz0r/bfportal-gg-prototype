import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set')
}

// Reuse one connection pool across dev-server module reloads.
const globalForDb = globalThis as { __bfportalSql?: postgres.Sql }

export const sql = globalForDb.__bfportalSql ?? postgres(url)
if (process.env.NODE_ENV !== 'production') {
  globalForDb.__bfportalSql = sql
}

export const db = drizzle(sql, { schema })
