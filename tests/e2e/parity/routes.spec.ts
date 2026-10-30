/**
 * Task 12 guard: the route crawl. Every page route in app/ (found on disk, so
 * a new page is crawled without editing this file) opens inside the shell, the
 * public layout or the sign-in layout, and draws at least one design-system
 * (`ds-`) element. Selecting on the `ds-` class is this test's job: the one
 * exception to locating by role, label or name.
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, readSeed, storagePath, test } from '../support/fixtures';

const APP = path.resolve(__dirname, '..', '..', '..', 'app');

/** Every app/**\/page.tsx as its URL pattern; route groups and parallel slots drop out of the URL. */
function pageRoutes(dir = APP, base = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name.startsWith('_') || name === 'api') continue;
      // An intercepting route like (.)component is the same URL as its target, crawled there.
      if (/^\(\.+\)/.test(name) || name.startsWith('@')) continue;
      const seg = /^\(.*\)$/.test(name) ? '' : `/${name}`;
      out.push(...pageRoutes(p, base + seg));
    } else if (name === 'page.tsx') {
      out.push(base || '/');
    }
  }
  return out.sort();
}

// The seed is written by the global setup, after this file is collected: read it per test.
function fill(route: string): string {
  const seed = readSeed();
  const ids: Record<string, string> = {
    projectId: String(seed.example.projectId),
    caseId: String(seed.example.baseCaseId),
    componentId: String(seed.example.productId),
    comparisonId: '1',
  };
  return route.replace(/\[(\w+)\]/g, (_, k: string) => {
    if (!(k in ids)) throw new Error(`route crawl: no seed id for [${k}] in ${route}`);
    return ids[k];
  });
}

/** Pages that need no account; the sign-in pages send a signed-in visitor on, so they are read signed out. */
const SIGNED_OUT = /^\/($|about|changelog|docs|pricing|product|legal\/|auth\/(login|signup))/;
/** The OAuth callback only exists mid sign-in (G108, G109 cover it); onboarding is a newcomer's. */
const SKIP = new Set(['/auth/callback']);
const NEWCOMER = new Set(['/auth/onboarding']);

const routes = pageRoutes().filter((r) => !SKIP.has(r));

async function checkLayout(page: Page, route: string) {
  const shell = page.getByRole('navigation', { name: 'Main' });
  const site = page.getByRole('navigation', { name: 'Site' });
  const auth = page.locator('.edu-auth');
  await expect(shell.or(site).or(auth).first(), `${route}: inside the shell, the public layout or sign-in`).toBeVisible({ timeout: 60_000 });
  expect(await page.locator('[class*="ds-"]').count(), `${route}: draws design-system elements`).toBeGreaterThan(0);
  // No classic chrome anywhere.
  await expect(page.locator('.app-shell, .app-topbar, [data-tour]'), `${route}: no classic top bar or tour anchors`).toHaveCount(0);
}

test.describe('route crawl', () => {
  test('every page route is found on disk', () => {
    expect(routes).toContain('/home');
    expect(routes).toContain('/project/[projectId]/case/[caseId]');
    expect(routes.length).toBeGreaterThan(30);
  });

  test.describe('signed in', () => {
    test.use({ storageState: storagePath('owner') });
    for (const route of routes.filter((r) => !SIGNED_OUT.test(r) && !NEWCOMER.has(r))) {
      test(`${route} opens in the new design`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.goto(fill(route));
        await checkLayout(page, route);
      });
    }
  });

  test.describe('signed out', () => {
    test.use({ storageState: storagePath('anon') });
    for (const route of routes.filter((r) => SIGNED_OUT.test(r))) {
      test(`${route} opens in the new design`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.goto(fill(route));
        await checkLayout(page, route);
      });
    }
  });

  test.describe('newcomer', () => {
    test.use({ storageState: storagePath('newcomer') });
    for (const route of routes.filter((r) => NEWCOMER.has(r))) {
      test(`${route} opens in the new design`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.goto(fill(route));
        await checkLayout(page, route);
      });
    }
  });
});
