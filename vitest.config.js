import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      // Zelfde alias als jsconfig.json ("@/*" -> "./src/*") — nodig zodra
      // tests Next.js route handlers importeren (die zelf @/lib/... gebruiken).
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.js'],
      exclude: ['src/lib/__tests__/**'],
    },
  },
})
