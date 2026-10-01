/**
 * F4b: the worked example, from the empty dashboard to a result.
 * docs/flows/USER_FLOWS.md §F4 (F4b.1–2) and §F9.1a.
 */
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

test('F4 worked example → Run Assessment → results shows the total', async ({ newUser, signIn }) => {
  const user = await newUser('example');
  const { page } = await signIn(user);
  await open(page, '/home', { ready: 'Open the worked example' });

  const built = page.waitForResponse((r) => r.url().includes('/api/example-project') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Open the worked example' }).click();
  expect((await built).status()).toBe(200);

  await expect(page).toHaveURL(/\/project\/\d+$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Example: painted steel bracket' })).toBeVisible();
  await page.getByRole('button', { name: 'Open editor' }).click();
  await expect(page).toHaveURL(/\/project\/\d+\/case\/\d+/);
  await expect(page.getByTestId('tree-canvas-viewport')).toBeVisible();

  // PROJ-1 is fixed: the example has its functional unit, so Run is enabled.
  const run = page.getByRole('button', { name: 'Run Assessment', exact: true });
  await expect(run).toBeEnabled();
  const posted = page.waitForResponse((r) => /\/api\/cases\/\d+\/assessments/.test(r.url()) && r.request().method() === 'POST');
  await run.click();
  expect((await posted).status()).toBe(201);

  await expect(page).toHaveURL(/\/case\/\d+\/results$/);
  await expect(page.getByText('TOTAL IMPACT · GLOBAL WARMING')).toBeVisible();
  // 0.8 kg steel × 1.9 + 0.57 kWh × 0.35 (US grid) = 1.7195 kg CO2 eq under TRACI 2.1.
  await expect(page.getByText('1.72', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Global Warming 1\.72 kg CO2 eq$/ })).toBeVisible();
});
