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

test('P51 P54 verdict and change by category, and no number across regions', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const user = await newUser('parity-verdict');
  const as = api.as(user.token);
  // The example project: the base case and its run what-if (a shorter cure cycle), both in the US.
  const ex = await as.post<{ project_id: number; case_id: number; what_if_case_id: number }>('/api/example-project');

  const { page } = await signIn(user);
  await open(page, `/project/${ex.project_id}/comparison?cases=${ex.case_id},${ex.what_if_case_id}`, { ready: 'Compare' });
  const verdict = page.getByRole('region', { name: 'Verdict' });
  await row(verdict.getByRole('heading', { name: 'Shorter cure cycle comes out ahead' }), 'P51', 'Verdict card');
  await row(verdict.getByText(/^Shorter cure cycle is \d+\.\d% lower in Global Warming than Base case\.$/), 'P51', 'Verdict card');
  const chart = page.getByRole('region', { name: 'Change by category' });
  await row(chart.getByRole('img', { name: /^Shorter cure cycle against Base case, by impact category: .*Global Warming \d+\.\d% lower/ }), 'P54', 'Delta vs baseline chart');

  // A copy run in another region: the region check fails, so neither card prints a number.
  const copy = await as.post<{ case_id: number }>(`/api/cases/${ex.case_id}/duplicate`, { case_name: 'My bracket' });
  await as.post(`/api/cases/${copy.case_id}/assessments`, { run_name: 'Elsewhere', region_code: 'Global' });
  await open(page, `/project/${ex.project_id}/comparison?cases=${ex.case_id},${copy.case_id}`, { ready: 'Compare' });
  await row(verdict.getByRole('heading', { name: 'No verdict yet' }), 'P51', 'Verdict card');
  await row(verdict.getByText('Region differs: US vs Global'), 'P51', 'Verdict card');
  await expect.soft(verdict.getByText(/\d%/), note('P51', 'Verdict card')).toHaveCount(0);
  await row(chart.getByText('No change by category yet: Region differs: US vs Global.'), 'P54', 'Delta vs baseline chart');
  await expect.soft(chart.getByRole('img'), note('P54', 'Delta vs baseline chart')).toHaveCount(0);
});
