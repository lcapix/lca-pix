/**
 * Drops the run's database. serve.mjs drops it too when Playwright stops the
 * webServer; doing it here as well means a server that is killed outright
 * still leaves nothing behind. E2E_KEEP_DB=1 keeps it for inspection.
 *
 * fresh.mjs runs as a child process: Playwright's TypeScript loader cannot
 * import an .mjs file.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SERVER_STATE } from './paths';

export default async function globalTeardown() {
  if (process.env.E2E_KEEP_DB === '1' || !existsSync(SERVER_STATE)) return;
  const envFile = path.join(REPO_ROOT, '.env.local');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const { database } = JSON.parse(readFileSync(SERVER_STATE, 'utf8')) as { database: string };
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'db', 'fresh.mjs'), '--drop', database], {
    env: process.env,
    encoding: 'utf8',
  });
  if (r.status !== 0) process.stderr.write(`[e2e teardown] could not drop ${database}: ${r.stderr}\n`);
}
