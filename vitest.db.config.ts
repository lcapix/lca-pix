/**
 * Database suite: `pnpm test:db`.
 *
 * The global setup builds a throwaway lcapix_t_* database from nothing
 * (db/baseline + every migration, via scripts/db/fresh.mjs) on the local
 * MySQL named by DATABASE_HOST/PORT/USER/PASSWORD (.env.local fills in what
 * the environment does not set), runs tests/db/** against it, and drops it.
 * Files run one at a time: some of them build and drop databases of their own.
 *
 * `pnpm test:db:e2e-local` also runs tests/e2e-local against the same fresh
 * database (LOCAL_DB=1, plus one fixture account those tests sign in as).
 * See docs/testing/DATABASE_TESTS.md.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

const withE2eLocal = process.env.DB_TESTS_E2E_LOCAL === '1';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/db/**/*.test.ts', ...(withE2eLocal ? ['tests/e2e-local/**/*.test.ts'] : [])],
    exclude: ['node_modules', '.next'],
    globalSetup: ['./tests/db/support/global-setup.ts'],
    setupFiles: ['./tests/setup.ts', './tests/db/support/worker-env.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
