/**
 * Kept and moved rows of Compare. The fair-check row (P64) and the what-if
 * (R15) are exercised by the compare journey.
 */
import { workedExample } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { note, row } from '../support/parity';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };

test('P58 P61 P62 P66 P70 P73 P76 P82 P83 compare two runs, then a stale one', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const user = await newUser('parity-compare');
  const as = api.as(user.token);
  const { projectId, caseId, baseCaseId } = await workedExample(api, user, 'My bracket');
  await as.post(`/api/cases/${caseId}/assessments`, { run_name: 'Assessment' });

  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/comparison?cases=${baseCaseId},${caseId}`, { ready: 'Compare' });
  await expect.soft(page, note('P61', 'Shareable ?cases= URL')).toHaveURL(new RegExp(`cases=${baseCaseId},${caseId}`));
  await row(page.getByRole('heading', { name: /^Compare/ }), 'P58', 'Breadcrumb and back button');
  await row(page.getByRole('link', { name: 'Overview' }), 'P58', 'Breadcrumb and back button');
  await row(page.getByRole('region', { name: 'Totals' }).getByText(/Same as A|lower|higher/), 'P66', 'Per-case total and % vs base');
  await row(page.getByRole('combobox', { name: 'Impact category' }), 'P83', 'Impact category selector');

  const again = page.waitForRequest((r) => r.method() === 'GET' && r.url().includes('/compare?cases='), { timeout: 15_000 });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.soft(again.then(() => true), note('P62', 'Re-read on window focus')).resolves.toBe(true);

  await row(page.getByRole('tab', { name: 'Data quality' }), 'P82', 'Data quality tab');
  await page.getByRole('button', { name: /Open in each case/ }).click();
  await row(page.getByRole('menuitem', { name: /My bracket/ }), 'P73', 'Per-case Results link');
  await row(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Reports' }), 'P76', 'Next: "Export a report"');

  const comps = (await as.get<{ components: Array<{ component_id: number; component_name: string }> }>(`/api/cases/${caseId}/components`)).components;
  const cut = comps.find((c) => c.component_name === '10. Cut blank')!;
  const flows = (await as.get<{ flows: Array<{ flow_id: number; substance_name?: string }> }>(`/api/components/${cut.component_id}/flows`)).flows;
  const steel = flows.find((f) => f.substance_name === 'Steel')!;
  await as.put(`/api/flows/${steel.flow_id}`, { quantity: 0.2 });
  await page.reload();
  await row(page.getByText('Last run out of date'), 'P70', 'Stale run marker');
});
