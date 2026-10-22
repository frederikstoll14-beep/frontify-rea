import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Integrationstests des MCP-Servers gegen einen lokalen Supabase-Stack (`npx supabase start`).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/mcp/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
})
