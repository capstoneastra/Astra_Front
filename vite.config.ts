import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

function serveMockWorker(): Plugin {
  return {
    name: 'astra-mock-service-worker',
    apply: 'serve',
    configureServer(server) {
      const worker = readFileSync(new URL(import.meta.resolve('msw/mockServiceWorker.js')))
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/mockServiceWorker.js') {
          next()
          return
        }
        response.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        response.setHeader('Cache-Control', 'no-cache')
        response.end(worker)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serveMockWorker()],
})
