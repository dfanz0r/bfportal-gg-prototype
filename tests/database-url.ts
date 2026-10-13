import { isLocalHost, loadLocalEnv } from '../src/server/local-env.ts'

const FALLBACK = 'postgres://bfportal:bfportal@localhost:5433/bfportal'

/**
 * Tests run in their own database on the development server, so they never
 * touch development data.
 */
export function testDatabaseUrl() {
  loadLocalEnv()
  const url = new URL(process.env.DATABASE_URL ?? FALLBACK)
  // Each run drops this database and creates it again. Changing the name is
  // not enough to make that safe: the server has to be this machine.
  if (!isLocalHost(url.hostname)) {
    throw new Error(
      `Refusing to run tests against "${url.hostname}": the test database is dropped and recreated, so it must be on this machine`,
    )
  }
  url.pathname = '/bfportal_test'
  return url.href
}
