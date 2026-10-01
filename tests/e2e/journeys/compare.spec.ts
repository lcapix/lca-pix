/**
 * F12: duplicate from the results page, then compare. An unrun copy is shown
 * but never ranked. docs/flows/USER_FLOWS.md §F12.
 */
import { workedExample } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

test('F12 duplicate from results ("Duplicate and change one thing") → compare shows the copy as incomplete, not ranked', async ({
  api,
  newUser,
  signIn,
}) => {
  const user = await newUser('compare');
  const { projectId, caseId } = await workedExample(api, user);
  await api.as(user.token).post(`/api/cases/${caseId}/assessments`, { run_name: 'Assessment' });

  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/case/${caseId}/results`, { ready: 'TOTAL IMPACT' });
  await page.getByRole('link', { name: 'Duplicate and change one thing' }).click();

  const dialog = page.getByRole('dialog', { name: /Duplicate this case/ });
  await expect(dialog).toBeVisible();
  const name = dialog.getByLabel(/name/i);
  await expect(name).toHaveValue('Painted steel bracket (copy)');
  await name.fill('Bracket, recycled steel');
  const duplicated = page.waitForResponse((r) => r.url().includes(`/api/cases/${caseId}/duplicate`));
  await dialog.getByRole('button', { name: 'Duplicate', exact: true }).click();
  const res = await duplicated;
  expect(res.status()).toBe(201);
  const copyId = (await res.json()).case_id as number;
  await expect(page).toHaveURL(new RegExp(`/project/${projectId}/case/${copyId}`));

  await open(page, `/project/${projectId}/comparison`, { ready: 'Compare cases' });
  const copyChip = page.getByRole('button', { name: /^Bracket, recycled steel COPY/ });
  await expect(copyChip).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Incomplete — not ranked')).toBeVisible();
  await expect(page.getByText('Not run yet', { exact: false }).first()).toBeVisible();
  // The only ranked case is the base: no "Lowest …" verdict names the copy.
  await expect(page.getByText(/Lowest Global Warming:\s*Bracket, recycled steel/)).toHaveCount(0);
});
