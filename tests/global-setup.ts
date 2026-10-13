import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

import { testDatabaseUrl } from './database-url.ts'

/** Recreates the test database and applies every migration to it. */
export default async function setup() {
  const url = new URL(testDatabaseUrl())
  const name = url.pathname.slice(1)
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to recreate "${name}": not a test database`)
  }

  const adminUrl = new URL(url)
  adminUrl.pathname = '/postgres'
  const admin = postgres(adminUrl.href, { max: 1, onnotice: () => {} })
  await admin.unsafe(`drop database if exists "${name}" with (force)`)
  await admin.unsafe(`create database "${name}"`)
  await admin.end()

  const sql = postgres(url.href, { max: 1, onnotice: () => {} })
  await migrate(drizzle(sql), { migrationsFolder: 'src/server/db/migrations' })
  await sql.end()
}
