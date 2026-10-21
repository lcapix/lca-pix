/**
 * Contract: the Content Security Policy is enforced and nothing the app does
 * breaks it; and no screen shows text a person should never read
 * (support/copy.ts: em dashes, "undefined", raw tags, shouting prefixes). Every screen in routes.json is opened as its actor with a
 * listener for `securitypolicyviolation` (and the console's "Refused to …"
 * lines as a second witness); a screen that trips the policy fails here before
 * it can fail for a user. The dev server adds 'unsafe-eval' only; the
 * production policy is checked the same way by scripts/perf/measure.mjs on a
 * production build.
 */
import type { Page } from '@playwright/test';
import { expect, readSeed, storagePath, test } from '../support/fixtures';
import { brokenCopy } from '../support/copy';
import { ROUTES, openRoute, type Actor } from '../support/routes';

const seed = () => readSeed();

/** Listen once per page; each call of the returned function hands back what was refused since the last. */
async function watch(page: Page): Promise<() => Promise<string[]>> {
  let refused: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(m.text())) refused.push(m.text().slice(0, 300));
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI || 'inline'}`));
  });
  return async () => {
    const inPage = await page.evaluate(() => {
      const w = window as unknown as { __csp?: string[] };
      const v = w.__csp ?? [];
      w.__csp = [];
      return v;
    });
    const out = [...refused, ...inPage];
    refused = [];
    return out;
  };
}

test('the policy is enforced, not report-only', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy'], 'Content-Security-Policy header').toContain("default-src 'self'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy-report-only']).toBeUndefined();
});

const byActor = new Map<Actor, typeof ROUTES>();
for (const r of ROUTES) byActor.set(r.as ?? 'owner', [...(byActor.get(r.as ?? 'owner') ?? []), r]);

for (const [actor, routes] of byActor) {
  test.describe(() => {
    test.use({ storageState: storagePath(actor) });
    test(`no CSP violation and no broken text on the ${routes.length} screens opened as ${actor}`, async ({ page }) => {
      test.setTimeout(60_000 + routes.length * 45_000);
      const seen: string[] = [];
      const read = await watch(page);
      const text: string[] = [];
      for (const route of routes) {
        await openRoute(page, route, seed());
        for (const v of await read()) seen.push(`${route.slug}: ${v}`);
        for (const t of await brokenCopy(page)) text.push(`${route.slug}: ${t}`);
      }
      expect(seen, 'CSP violations').toEqual([]);
      expect(text, 'text a person should never read (support/copy.ts)').toEqual([]);
    });
  });
}
