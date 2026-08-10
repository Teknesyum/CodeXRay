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
  server: { proxy: webReaderProxy },
  preview: { proxy: webReaderProxy },
})
