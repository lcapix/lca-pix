/**
 * Kept and moved rows of Results and Write-up. Export (R13) and the what-if
 * (R15) are exercised by the journeys.
 */
import { openCase, workedExample } from '../support/editor';
import { test } from '../support/fixtures';
import { row } from '../support/parity';

test('R01 R02 R06 the full results page and a run with a method', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-full-results');
  const as = api.as(user.token);
  const { projectId, caseId } = await workedExample(api, user);
  await as.post(`/api/cases/${caseId}/assessments`, { calculation_method: 'TRACI 2.1', region_code: 'US' });
  const { page } = await signIn(user);
  await page.goto(`/project/${projectId}/case/${caseId}/results`);
  await row(page.getByRole('main'), 'R01', 'Full-page results, printable');
  await row(page.getByRole('radiogroup', { name: 'Category' }), 'R06', 'Switch the whole page to another category');
  await row(page.getByRole('radiogroup', { name: 'Chart' }), 'P52', 'Absolute, Radar and Log');
  await row(page.getByRole('region', { name: 'Cost by kind' }).or(page.locator('[aria-label="Cost by kind"]')), 'P53', 'Cost by kind and cost per unit impact');
  await row(page.locator('[aria-label="Steps stacked by cost"]'), 'P55', 'Stacked step bar');
  await row(page.locator('[aria-label="This case"]'), 'P50', 'Case card change against the base case');
  await row(page.locator('[aria-label="Step diff"]'), 'P56', 'Step diff against the base case');
  await page.goto(`/project/${projectId}/case/${caseId}`);
  await page.getByRole('button', { name: 'Run Assessment' }).click();
  await row(page.getByRole('dialog', { name: 'Run assessment' }), 'R02', 'Choose method and region for a run');
});

test('R12 R14 R16 an older run, the write-up, and Magic Insights', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-results');
  const as = api.as(user.token);
  const { projectId, caseId } = await workedExample(api, user);
  const first = await as.post<{ run_id: number }>(`/api/cases/${caseId}/assessments`, { run_name: 'First' });
  await as.post(`/api/cases/${caseId}/assessments`, { run_name: 'Second' });

  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await page.goto(`/project/${projectId}/case/${caseId}?tab=results&run=${first.run_id}`);
  await row(page.getByText(/is an older run/), 'R12', 'Older-run banner');

  await page.getByRole('tab', { name: /^Write-up/ }).click();
  await row(page.getByRole('complementary', { name: /^Write-up,/ }), 'R14', 'Write-up');

  await page.getByRole('tab', { name: /^Results/ }).click();
  await row(page.getByRole('button', { name: 'Magic Insights' }), 'R16', 'Magic Insights on the selected category');
});
