import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ plugins: ['./src/server/startup.ts'] }),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        // Nothing under src/server may reach the browser bundle. Client code
        // gets at it through the server functions in src/functions, or through
        // a route's server handlers. A violation fails the build.
        client: { files: ['**/*.server.*', '**/src/server/**'] },
      },
    }),
    solidPlugin({ ssr: true }),
  ],
})
