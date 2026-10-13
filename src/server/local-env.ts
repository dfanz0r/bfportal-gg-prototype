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

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1']

/**
 * Whether a database host is this machine. The seed and the tests empty or
 * drop databases, and check this before they connect.
 */
export function isLocalHost(hostname: string) {
  return LOCAL_HOSTS.includes(hostname)
}
