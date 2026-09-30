/**
 * API, authorization and security suite against a real MySQL: `pnpm test:api`.
 *
 * Reuses the database suite's global setup: it builds a throwaway lcapix_t_*
 * database from nothing (db/baseline + every migration, scripts/db/fresh.mjs)
 * on the local MySQL named by DATABASE_HOST/PORT/USER/PASSWORD (.env.local
 * fills in what the environment does not set), and drops it afterwards, pass
 * or fail. Tests call the route handlers directly (no dev server); only
 * outbound network (BLS, EIA, Metals-API, Electricity Maps, PubChem, Google,
 * Hugging Face) is mocked. See "API suite" in docs/testing/DATABASE_TESTS.md.
 *
 * Files run one at a time: they share the one database, and the SQL-injection
 * fuzz compares row counts before and after.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/api-real/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    globalSetup: ['./tests/db/support/global-setup.ts'],
    setupFiles: ['./tests/setup.ts', './tests/db/support/worker-env.ts', './tests/api-real/support/setup.ts'],
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
