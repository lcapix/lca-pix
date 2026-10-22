import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // tests/db and tests/api-real need a MySQL server: they run under
    // vitest.db.config.ts (pnpm test:db) and vitest.api.config.ts (pnpm test:api).
    exclude: ['node_modules', '.next', 'tests/db/**', 'tests/api-real/**'],
    testTimeout: 10000,
    environmentMatchGlobs: [
      ['tests/components/**', 'jsdom'],
      ['tests/app/**', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
