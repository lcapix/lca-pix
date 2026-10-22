/**
 * F4b: the worked example, from the empty dashboard to a result.
 * docs/flows/USER_FLOWS.md §F4 and §F9.1a (same journey as tests/e2e/journeys/worked-example.spec.ts).
 */
import { expect, test } from '../support/fixtures.ts';

test('worked example → Run Assessment → results show the total', async ({ screen, browser, newUser, signIn }) => {
  const user = await newUser('example');
  await signIn(user, '/home');

  await screen.getByRole('button', 'Open the worked example').tap();
  await expect(browser).toHaveURL(/\/project\/\d+$/, { timeout: 30_000 });
  await expect(screen.getByRole('heading', 'Example: painted steel bracket', { level: 1 })).toBeVisible();

  await screen.getByRole('button', 'Open editor').tap();
  await expect(browser).toHaveURL(/\/project\/\d+\/case\/\d+$/, { timeout: 30_000 });
  await expect(screen.getByTestId('tree-canvas-viewport')).toBeVisible({ timeout: 60_000 });

  // The example has its functional unit, so Run Assessment is enabled (PROJ-1).
  const run = screen.getByRole('button', 'Run Assessment');
  await expect(run).toBeEnabled();
  await run.tap();

  await expect(browser).toHaveURL(/\/case\/\d+\/results$/, { timeout: 60_000 });
  await expect(screen.getByText('TOTAL IMPACT · GLOBAL WARMING')).toBeVisible({ timeout: 30_000 });
  // 0.8 kg steel × 1.9 + 0.57 kWh × 0.35 (US grid) = 1.7195 kg CO2 eq under TRACI 2.1.
  await expect(screen.getByText('1.72').first()).toBeVisible();
  await expect(screen.getByRole('button', /^Global Warming 1\.72 kg CO2 eq$/)).toBeVisible();
});
