import { loadLocalEnv } from '../src/server/local-env.ts'

const FALLBACK = 'postgres://bfportal:bfportal@localhost:5433/bfportal'

/**
 * Tests run in their own database on the development server, so they never
 * touch development data.
 */
export function testDatabaseUrl() {
  loadLocalEnv()
  const url = new URL(process.env.DATABASE_URL ?? FALLBACK)
  url.pathname = '/bfportal_test'
  return url.href
}
