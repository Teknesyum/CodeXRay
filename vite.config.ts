import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  plugins: [react()],
  server: { proxy: webReaderProxy },
  preview: { proxy: webReaderProxy },
})
