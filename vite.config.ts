import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config'
import { name, version } from './package.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  base: './',
  build: {
    rollupOptions: {
      input: {
        blocked: 'src/blocked/index.html',
      },
    },
  },
  plugins: [
    svelte({
      compilerOptions: {
        dev: true,
      },
    }),
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
  ],
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
})
