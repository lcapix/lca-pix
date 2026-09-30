/**
 * The `test` every spec imports. On top of Playwright's own fixtures:
 *
 *   context/page  guarded: only http://localhost:<port> loads (support/net.ts)
 *   seed          the shared world from global setup (support/seed.ts)
 *   api           an Api client (support/api.ts), unauthenticated; .as(token)
 *   newUser()     a fresh onboarded account for a test that changes data
 *   signIn()      a guarded context + page signed in as a given account
 *
 * Tests that only read use `test.use({ storageState: storagePath('owner') })`
 * (or 'viewer', 'empty', 'newcomer', 'anon').
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { Api, storageStateFor, uniqueEmail, type ApiUser } from './api';
import { installNetGuard } from './net';
import { BASE_URL, SEED_STATE, STATE_DIR } from './paths';
import type { Seed } from './seed';

export { expect };

export function storagePath(actor: 'owner' | 'viewer' | 'empty' | 'newcomer' | 'anon'): string {
  return path.join(STATE_DIR, `${actor}.storage.json`);
}

let cachedSeed: Seed | undefined;
export function readSeed(): Seed {
  if (!cachedSeed) cachedSeed = JSON.parse(readFileSync(SEED_STATE, 'utf8')) as Seed;
  return cachedSeed;
}

/** The same context options the config gives the default context. */
export const CONTEXT_DEFAULTS = {
  baseURL: BASE_URL,
  locale: 'en-US',
  timezoneId: 'UTC',
  reducedMotion: 'reduce' as const,
  colorScheme: 'light' as const,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  serviceWorkers: 'block' as const,
  acceptDownloads: true,
};

export async function guardedContext(browser: Browser, user?: ApiUser): Promise<BrowserContext> {
  const context = await browser.newContext({
    ...CONTEXT_DEFAULTS,
    storageState: user ? storageStateFor(user) : { cookies: [], origins: [] },
  });
  await installNetGuard(context);
  return context;
}

type Fixtures = {
  seed: Seed;
  api: Api;
  newUser: (label?: string, opts?: { onboard?: boolean }) => Promise<ApiUser>;
  signIn: (user: ApiUser) => Promise<{ context: BrowserContext; page: Page }>;
};

export const test = base.extend<Fixtures>({
  context: async ({ context }, use) => {
    await installNetGuard(context);
    await use(context);
  },
  seed: async ({}, use) => {
    await use(readSeed());
  },
  api: async ({ request }, use) => {
    await use(new Api(request));
  },
  newUser: async ({ api }, use, testInfo) => {
    await use(async (label = 'journey', opts = {}) => {
      const slug = testInfo.titlePath.slice(-1)[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24);
      return api.createUser({
        email: uniqueEmail(`${label}-${slug}`),
        fullName: 'Jordan Journey',
        onboard: opts.onboard,
      });
    });
  },
  signIn: async ({ browser }, use) => {
    const opened: BrowserContext[] = [];
    await use(async (user) => {
      const context = await guardedContext(browser, user);
      opened.push(context);
      return { context, page: await context.newPage() };
    });
    for (const c of opened) await c.close();
  },
});
