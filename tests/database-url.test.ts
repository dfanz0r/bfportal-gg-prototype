import { afterEach, describe, expect, it, vi } from 'vitest'

import { testDatabaseUrl } from './database-url'

describe('test database', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is its own database on this machine', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost:5433/bfportal')
    expect(testDatabaseUrl()).toBe(
      'postgres://u:p@localhost:5433/bfportal_test',
    )
  })

  it('is refused on any other server, whatever the database is called', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@db.example.com:5432/bfportal')
    expect(() => testDatabaseUrl()).toThrow(/must be on this machine/)
  })
})
