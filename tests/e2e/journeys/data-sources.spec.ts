/**
 * G3: a student (not an admin) opens Data sources from the factor library and
 * reads where the numbers come from: the cost sources say live or reference,
 * the factors are grouped by the dataset they cite, and Electricity Maps,
 * which nothing calls, is not shown.
 */
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

test('G3 a student reads where every number comes from', async ({ newUser, signIn }) => {
  const user = await newUser('sources');
  const { page } = await signIn(user);
  await open(page, '/library/sources', { ready: 'Data sources' });

  const cost = ['BLS', 'EIA', 'Metals-API'];
  for (const name of cost) {
    const card = page.getByRole('region', { name: new RegExp(`^${name}: `) });
    await expect(card).toBeVisible();
    // The test server has no live keys: each says Reference and names the dated values.
    await expect(card).toContainText('Reference');
    await expect(card).toContainText('2026-06');
    await expect(card).toContainText('In the app:');
  }
  await expect(page.getByRole('region', { name: /^openLCA: / })).toBeVisible();
  await expect(page.getByRole('region', { name: /^PubChem: / })).toBeVisible();
  await expect(page.getByText('Electricity Maps')).toHaveCount(0);

  const table = page.getByRole('table', { name: 'Factors per cited dataset' });
  const traci = table.getByRole('row', { name: /US EPA TRACI 2\.1/ });
  await expect(traci).toBeVisible();
  expect(Number((await traci.getByRole('cell').nth(1).innerText()).replace(/,/g, ''))).toBeGreaterThan(600);

  // It links on to each factor's own source.
  await page.getByRole('link', { name: 'factor library' }).click();
  await expect(page).toHaveURL(/\/library\/factors/);
  // And browser back returns to it.
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Data sources' })).toBeVisible();
  // A student is not offered the admin page.
  await expect(page.getByRole('link', { name: 'Integrations' })).toHaveCount(0);
});
