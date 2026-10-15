import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Integrationstests gegen einen lokalen Supabase-Stack (`npx supabase start`).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/db/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
})
