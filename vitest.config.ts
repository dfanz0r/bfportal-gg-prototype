import { defineConfig } from 'vitest/config'

import { testDatabaseUrl } from './tests/database-url.ts'

export default defineConfig({
  test: {
    globalSetup: './tests/global-setup.ts',
    // Every test file shares the one test database.
    fileParallelism: false,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      BETTER_AUTH_URL: 'http://localhost:3000',
      BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
      DISCORD_CLIENT_ID: 'test-client-id',
      DISCORD_CLIENT_SECRET: 'test-client-secret',
    },
  },
})
