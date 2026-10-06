// LCAPIX UI tests with e2e (TesterArmy), 2026-10-06. Exact checks only (`screen`, `expect`, `fetch`): no model,
// no cost, no agent steps. The runner starts the app itself: support/serve.mjs builds a throwaway database
// (lcapix_t_e2e_*) on the local MySQL, runs `next dev -p 3150` on it with outbound network blocked, warms the
// pages, and drops the database when the run ends. Run with `pnpm e2e:tester` from the repo root.
// See docs/testing/E2E_TESTER.md.
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

const PORT = 3150;

/** What the server needs from this shell (CI sets the DB through env; locally .env.local fills the gaps). */
const passThrough = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'JWT_SECRET',
  'E2E_WARM',
  'E2E_KEEP_DB',
  'E2E_ARTIFACTS_DIR',
  'NODE_OPTIONS',
] as const;
const env: Record<string, string> = { E2E_PORT: String(PORT), E2E_READY_PORT: String(PORT + 1), NEXT_TELEMETRY_DISABLED: '1' };
for (const name of passThrough) {
  const value = process.env[name];
  if (value !== undefined) env[name] = value;
}

export default {
  tests: 'tests/**/*.e2e.ts',
  targets: [
    {
      engine: web({ viewport: { width: 1440, height: 900 } }),
      app: {
        url: `http://localhost:${PORT}`,
        // Answers only once the database is built and the pages are compiled.
        readyUrl: `http://127.0.0.1:${PORT + 1}/`,
        command: {
          executable: 'node',
          args: ['e2e-tester/support/serve.mjs'],
          cwd: '..',
          env,
          startupTimeout: 600_000,
          shutdownTimeout: 30_000,
          log: '.e2e/logs/app.log',
        },
      },
    },
  ],
  timeout: 180_000,
  actionTimeout: 30_000,
  assertionTimeout: 15_000,
  // `next dev` compiles and serves every page for both workers; more makes it the bottleneck.
  workers: 2,
  // A failure locally is a failure; CI gets e2e's default one retry (a slow shared runner).
  retries: process.env.CI ? 1 : 0,
  trace: 'retain-on-failure',
  // No agent steps, so nothing to replay.
  cache: 'off',
} satisfies E2EConfig;
