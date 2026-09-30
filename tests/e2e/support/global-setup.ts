/**
 * Runs after the webServer (serve.mjs) is up on a fresh database:
 *   1. seeds the shared world through the app's API (support/seed.ts),
 *   2. writes the seed ids and one storage state per seeded user,
 *   3. opens every route once in a real browser, so `next dev` compiles each
 *      page, its client chunks and the API routes it calls before any test
 *      starts. Otherwise the first test to open a page pays for the compile
 *      inside its own timeout, and every compile pushes a rebuild to the pages
 *      other workers have open. E2E_WARM=0 skips this (quicker single-test
 *      debugging).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, request } from '@playwright/test';
import { storageStateFor } from './api';
import { installNetGuard } from './net';
import { buildSeed } from './seed';
import { BASE_URL, SEED_STATE, STATE_DIR } from './paths';
import { ROUTES, idsFromSeed, resolvePath } from './routes';
import { settle } from './ui';

function storageFile(actor: string): string {
  return path.join(STATE_DIR, `${actor}.storage.json`);
}

export default async function globalSetup() {
  const started = Date.now();
  const log = (s: string) => process.stderr.write(`[e2e setup] ${s} (${((Date.now() - started) / 1000).toFixed(1)} s)\n`);
  mkdirSync(STATE_DIR, { recursive: true });

  const ctx = await request.newContext({ baseURL: BASE_URL });
  const seed = await buildSeed(ctx, BASE_URL).finally(() => ctx.dispose());
  writeFileSync(SEED_STATE, JSON.stringify(seed, null, 2));
  for (const [actor, user] of Object.entries(seed.users)) {
    writeFileSync(storageFile(actor), JSON.stringify(storageStateFor(user, BASE_URL), null, 2));
  }
  writeFileSync(storageFile('anon'), JSON.stringify({ cookies: [], origins: [] }));
  log('seeded');

  if (process.env.E2E_WARM === '0') return;
  const ids = idsFromSeed(seed);
  const browser = await chromium.launch();
  try {
    const queue = ROUTES.slice();
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        const context = await browser.newContext({ baseURL: BASE_URL, storageState: storageFile(r.as ?? 'owner'), reducedMotion: 'reduce' });
        await installNetGuard(context);
        const page = await context.newPage();
        try {
          await page.goto(resolvePath(r.path, ids), { timeout: 180_000 });
          await settle(page, { timeout: 60_000 });
        } catch (e) {
          log(`warm-up of ${r.slug} failed: ${(e as Error).message.split('\n')[0]}`);
        } finally {
          await context.close();
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  } finally {
    await browser.close();
  }
  log(`warmed ${ROUTES.length} routes`);
}
