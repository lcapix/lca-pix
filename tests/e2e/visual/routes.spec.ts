/**
 * Visual baseline: every route in routes.json and every interactive state in
 * support/states.ts, full page, at 1440×900, 1024×768 and 390×844.
 *
 *   pnpm e2e:visual   compare with tests/e2e/__snapshots__/visual/*-<platform>.png
 *   pnpm e2e:update   rewrite them (review every changed image before committing)
 *
 * Deterministic by construction: a fresh database seeded in a fixed order,
 * reduced motion, UTC / en-US, animations disabled, the dev overlay and
 * toasts hidden (screenshot.css), and dates, relative times and run numbers
 * masked (support/visual.ts).
 */
import { expect, readSeed, storagePath, test } from '../support/fixtures';
import { ROUTES, VIEWPORTS, openRoute } from '../support/routes';
import { STATES, openState } from '../support/states';
import { waitForHydration } from '../support/ui';
import { pauseAuthHero, pinClock, snap } from '../support/visual';

const AUTH_HERO = ['login', 'signup'];

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}×${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test.describe(() => {
        test.use({ storageState: storagePath(route.as ?? 'owner') });
        test(`${route.slug}`, async ({ page }) => {
          await pinClock(page, readSeed().seededAt);
          if (AUTH_HERO.includes(route.slug)) {
            // Freeze the rotating hero on its first scenario before settling.
            await page.goto(route.path);
            await waitForHydration(page);
            await pauseAuthHero(page);
            await expect(page.getByText(route.ready!).first()).toBeVisible();
          } else {
            await openRoute(page, route, readSeed());
          }
          await snap(page, `${route.slug}-${vp.name}`);
        });
      });
    }

    test.describe(() => {
      test.use({ storageState: storagePath('owner') });
      for (const state of STATES) {
        test(`${state.slug}`, async ({ page }) => {
          // BUG (responsive): at 390 px the case editor has no phone layout;
          // the node-details strip (a <section>) covers the outline, so
          // "Add Component" cannot be clicked. Enable once P04 lays it out.
          test.fixme(vp.name === 'phone' && state.slug === 'component-dialog', 'Add Component is covered by the details strip at 390 px');
          await pinClock(page, readSeed().seededAt);
          await openState(page, state, readSeed());
          await snap(page, `${state.slug}-${vp.name}`, state.target?.(page));
        });
      }
    });
  });
}
