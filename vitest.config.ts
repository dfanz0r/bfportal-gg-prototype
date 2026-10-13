import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

import { testDatabaseUrl } from './tests/database-url.ts'

export default defineConfig({
  // Compiles JSX for the component tests, which opt into a DOM per file.
  plugins: [solid()],
  test: {
    // Server tests run in Node. A component test asks for a DOM itself, with
    // a `@vitest-environment happy-dom` comment at the top of the file.
    environment: 'node',
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
