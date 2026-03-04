import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
      ],
    },
  },
})
