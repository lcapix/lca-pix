/**
 * F4b: the worked example, from the empty Home to a result of your own.
 * docs/flows/USER_FLOWS.md §F4 (F4b.1–2) and §F9.1a, on the education
 * screens: the sample study arrives finished and read-only (E02), so the
 * path to a run of your own is Make my own copy → Run Assessment (E03, E05).
 */
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

// Navigations below can wait on a `next dev` compile (it evicts pages idle
// for 60 s), which under parallel load takes longer than the 20 s default.
const NAV = { timeout: 90_000 };

test('F4 the sample study → Make my own copy → Run Assessment → Results shows the answer', async ({ newUser, signIn }) => {
  const user = await newUser('example');
  const { page } = await signIn(user);
  await open(page, '/home', { ready: 'Open the sample study' });

  const built = page.waitForResponse((r) => r.url().includes('/api/example-project') && r.request().method() === 'POST', NAV);
  await page.getByRole('button', { name: 'Open the sample study' }).click();
  expect((await built).status()).toBe(200);

  // Home is the sample's Overview, answered by the sample's own run:
  // 0.8 kg steel × 1.9 + 0.57 kWh × 0.35 (US grid) + 0.0013 kWh deburring = 1.72 kg CO2 eq, TRACI 2.1.
  await expect(page.getByText('Sample study', { exact: true })).toBeVisible(NAV);
  await expect(page.getByText('1.72', { exact: true }).first()).toBeVisible(NAV);

  const copied = page.waitForResponse((r) => /\/api\/cases\/\d+\/duplicate/.test(r.url()) && r.request().method() === 'POST', NAV);
  await page.locator('header').getByRole('button', { name: 'Make my own copy' }).click();
  expect((await copied).status()).toBe(201);
  await expect(page).toHaveURL(/\/project\/\d+\/case\/\d+$/, NAV);
  await expect(page.getByRole('tree')).toBeVisible(NAV);

  // The copy has every step and flow and no run of its own.
  const run = page.getByRole('button', { name: 'Run Assessment', exact: true });
  await expect(run).toBeEnabled(NAV);
  const posted = page.waitForResponse((r) => /\/api\/cases\/\d+\/assessments/.test(r.url()) && r.request().method() === 'POST', NAV);
  await run.click();
  expect((await posted).status()).toBe(201);

  await expect(page).toHaveURL(/tab=results/, NAV);
  await expect(page.getByText('What builds this number')).toBeVisible(NAV);
  // A copy is comparative: its answer has three decimals (rules.md).
  await expect(page.locator('.ws-answer-num')).toHaveText('1.720');
  await expect(page.getByText(/^10\. Cut blank/).first()).toBeVisible();
});
