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
    // tests/db needs a MySQL server: it runs under vitest.db.config.ts (pnpm test:db).
    exclude: ['node_modules', '.next', 'tests/db/**'],
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
