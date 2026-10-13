import { existsSync } from 'node:fs'

/**
 * Loads `.env.local` outside production. Variables that are already set win.
 *
 * Production takes its configuration from the real environment only.
 */
export function loadLocalEnv() {
  if (process.env.NODE_ENV !== 'production' && existsSync('.env.local')) {
    process.loadEnvFile('.env.local')
  }
}
