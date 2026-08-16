import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const packageMetadata = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

const webReaderTarget = process.env.CODEXRAY_WEB_READER_ORIGIN ?? 'https://serkanozel.me'
const webReaderProxy = {
  '/api/codexray/read-url': {
    target: webReaderTarget,
    changeOrigin: true,
    secure: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.CODEXRAY_BASE_PATH ?? '/',
  define: { __CODEXRAY_VERSION__: JSON.stringify(packageMetadata.version) },
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'simulators-graph', test: /extendedGraphSimulators\.ts$/ },
            { name: 'simulators-array', test: /extendedArraySimulators\.ts$/ },
            { name: 'simulators-string', test: /extendedStringSimulators\.ts$/ },
            { name: 'simulators-compound', test: /compoundSimulators\.ts$/ },
            { name: 'trace-intelligence', test: /services[\\/]trace[\\/](?:significance|traceOutline|traceQuery|simulationTrace)\.ts$/ },
          ],
        },
      },
    },
  },
  server: { proxy: webReaderProxy },
  preview: { proxy: webReaderProxy },
})
