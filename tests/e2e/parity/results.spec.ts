/**
 * Kept and moved rows of Results and Write-up. Export (R13) and the what-if
 * (R15) are exercised by the journeys.
 */
import { openCase, workedExample } from '../support/editor';
import { test } from '../support/fixtures';
import { row } from '../support/parity';

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
