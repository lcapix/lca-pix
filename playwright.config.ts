/**
 * Browser suite: user journeys, visual and accessibility baselines, and the
 * contract tests that pin test ids, accessible names and tour anchors.
 * See docs/testing/E2E_TESTS.md.
 *
 *   pnpm e2e            journeys + contracts
 *   pnpm e2e:visual     screenshot baseline
 *   pnpm e2e:a11y       axe baseline (fails only on new violations)
 *   pnpm e2e:update     rewrite the screenshot baseline
 *
 * Each run gets its own database: the webServer (tests/e2e/support/serve.mjs)
 * builds lcapix_t_e2e_* with scripts/db/fresh.mjs on the local MySQL and
 * starts `next dev -p 3120` on it; global setup seeds it through the app's
 * API; global teardown (and the server's own shutdown) drops it.
 */
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { ARTIFACTS_DIR, BASE_URL } from './tests/e2e/support/paths';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  // Outside the repo on purpose: see ARTIFACTS_DIR in tests/e2e/support/paths.ts.
  outputDir: path.join(ARTIFACTS_DIR, 'results'),
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFileDir}/{arg}-{platform}{ext}',
  timeout: 120_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixels: 0,
      threshold: 0.2,
      stylePath: './tests/e2e/visual/screenshot.css',
    },
  },
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 3,
  reporter: CI ? [['list'], ['html', { open: 'never', outputFolder: path.join(ARTIFACTS_DIR, 'report') }]] : [['list']],
  globalSetup: './tests/e2e/support/global-setup.ts',
  globalTeardown: './tests/e2e/support/global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    locale: 'en-US',
    timezoneId: 'UTC',
    // Not a top-level `use` option: it goes through contextOptions.
    contextOptions: { reducedMotion: 'reduce' },
    colorScheme: 'light',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    acceptDownloads: true,
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--force-color-profile=srgb', '--font-render-hinting=none'] },
  },
  projects: [
    { name: 'journeys', testMatch: 'journeys/**/*.spec.ts' },
    { name: 'contracts', testMatch: 'contracts/**/*.spec.ts' },
    { name: 'visual', testMatch: 'visual/**/*.spec.ts', fullyParallel: true },
    { name: 'a11y', testMatch: 'a11y/**/*.spec.ts', fullyParallel: true },
  ],
  webServer: {
    command: 'node tests/e2e/support/serve.mjs',
    url: `${BASE_URL}/auth/login`,
    // E2E_REUSE=1: attach to a server you started yourself with
    // `node tests/e2e/support/serve.mjs` (fast edit-run loop; see E2E_TESTS.md).
    reuseExistingServer: process.env.E2E_REUSE === '1',
    timeout: 240_000,
    stdout: process.env.E2E_SERVER_LOG ? 'pipe' : 'ignore',
    stderr: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
  },
});
