import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { env } from '../env'
import * as schema from './schema'

const isProduction = process.env.NODE_ENV === 'production'

function createPool() {
  const pool = postgres(env.DATABASE_URL, {
    max: 10,
    // Seconds. The driver's default connect timeout is 30.
    connect_timeout: 10,
    idle_timeout: 30,
  })

  if (isProduction) {
    // On SIGTERM the Node server stops taking requests and waits for the
    // process to run out of work, but an idle connection keeps it alive until
    // `idle_timeout`. A container runtime would give up waiting and kill it.
    // Running queries get five seconds to finish.
    process.once('SIGTERM', () => void pool.end({ timeout: 5 }))
  }
  return pool
}

// Reuse one connection pool across dev-server module reloads.
const globalForDb = globalThis as { __bfportalSql?: postgres.Sql }

export const sql = globalForDb.__bfportalSql ?? createPool()
if (!isProduction) {
  globalForDb.__bfportalSql = sql
}

export const db = drizzle(sql, { schema })
