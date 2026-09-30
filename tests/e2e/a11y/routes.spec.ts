/**
 * Accessibility baseline: axe-core on every route in routes.json and every
 * interactive state in support/states.ts, at 1440×900.
 *
 * tests/e2e/a11y/baseline.json records, per screen, how many elements break
 * each rule today. A test fails only when a screen gets a rule it did not have
 * or more elements breaking one it had — so later work can ratchet the
 * numbers down but never up. Fewer violations than the baseline pass, with an
 * annotation asking for the baseline to be lowered.
 *
 *   pnpm e2e:a11y          check against the baseline
 *   pnpm e2e:a11y:update   rewrite baseline.json (two passes; each screen keeps
 *                          the higher count per rule, since a canvas that is
 *                          still fitting can hide an element from axe)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, readSeed, storagePath, test } from '../support/fixtures';
import { ARTIFACTS_DIR, E2E_DIR } from '../support/paths';
import { ROUTES, openRoute } from '../support/routes';
import { STATES, openState } from '../support/states';

export const A11Y_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
export const BASELINE_FILE = path.join(E2E_DIR, 'a11y', 'baseline.json');
export const RESULTS_DIR = path.join(ARTIFACTS_DIR, 'a11y');

type RuleCount = { impact: string; count: number };
type Baseline = { screens: Record<string, Record<string, RuleCount>> };

const baseline: Baseline = existsSync(BASELINE_FILE)
  ? (JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as Baseline)
  : { screens: {} };
const updating = process.env.A11Y_UPDATE_BASELINE === '1';

async function audit(page: Page, slug: string): Promise<void> {
  const result = await new AxeBuilder({ page }).withTags(A11Y_TAGS).exclude('nextjs-portal')
    // Toasts come and go on a timer; a screen's baseline must not depend on
    // whether one was still up. (The toaster itself is checked on /auth/login.)
    .exclude('[data-sonner-toaster]').analyze();
  const found: Record<string, RuleCount> = {};
  for (const v of result.violations) found[v.id] = { impact: v.impact ?? 'unknown', count: v.nodes.length };

  // Every run leaves its findings for the report and for e2e:a11y:update.
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    // One file per repeat: e2e:a11y:update runs twice and keeps the worst count.
    path.join(RESULTS_DIR, `${slug}.${test.info().repeatEachIndex}.${test.info().retry}.json`),
    JSON.stringify({ slug, rules: found, details: result.violations.map((v) => ({ id: v.id, help: v.help, targets: v.nodes.map((n) => n.target.join(' ')) })) }, null, 2),
  );
  if (process.env.A11Y_DEBUG === '1') {
    for (const v of result.violations) console.log(`[a11y] ${slug} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  }
  if (updating) return;

  const known = baseline.screens[slug];
  expect(known, `${slug} is not in baseline.json: run pnpm e2e:a11y:update and commit it`).toBeDefined();
  const worse = Object.entries(found)
    .filter(([rule, v]) => v.count > (known?.[rule]?.count ?? 0))
    .map(([rule, v]) => {
      const detail = result.violations.find((x) => x.id === rule)!;
      return `${rule} (${v.impact}): ${known?.[rule]?.count ?? 0} → ${v.count}. ${detail.help}\n    ${detail.nodes
        .slice(0, 5)
        .map((n) => n.target.join(' '))
        .join('\n    ')}`;
    });
  const better = Object.entries(known ?? {})
    .filter(([rule, v]) => (found[rule]?.count ?? 0) < v.count)
    .map(([rule, v]) => `${rule} ${v.count} → ${found[rule]?.count ?? 0}`);
  if (better.length) test.info().annotations.push({ type: 'fewer violations: lower the baseline', description: better.join(', ') });
  expect(worse, `new accessibility violations on ${slug}`).toEqual([]);
}

const seed = () => readSeed();

for (const route of ROUTES) {
  test.describe(() => {
    test.use({ storageState: storagePath(route.as ?? 'owner') });
    test(`axe: ${route.slug} (${route.path})`, async ({ page }) => {
      await openRoute(page, route, seed());
      await audit(page, route.slug);
    });
  });
}

test.describe(() => {
  test.use({ storageState: storagePath('owner') });
  for (const state of STATES) {
    test(`axe: ${state.slug}`, async ({ page }) => {
      await openState(page, state, seed());
      await audit(page, state.slug);
    });
  }
});
