/**
 * F12: duplicate from the results page, then compare. A copy that has not been
 * run is shown but never ranked. docs/flows/USER_FLOWS.md §F12
 * (same journey as tests/e2e/journeys/compare.spec.ts).
 */
import { workedExample } from '../support/api.ts';
import { expect, test } from '../support/fixtures.ts';

test('duplicate from results → compare shows the unrun copy as "Incomplete — not ranked"', async ({ app, screen, browser, api, newUser, signIn }) => {
  const user = await newUser('compare');
  const { projectId, caseId } = await workedExample(api, user);
  await api.as(user.token).post(`/api/cases/${caseId}/assessments`, { run_name: 'Assessment' });
  await signIn(user, `/project/${projectId}/case/${caseId}/results`);
  await expect(screen.getByText('TOTAL IMPACT · GLOBAL WARMING')).toBeVisible({ timeout: 60_000 });

  await screen.getByRole('link', 'Duplicate and change one thing').tap();
  const dialog = screen.getByRole('dialog', /Duplicate this case/);
  await expect(dialog).toBeVisible();
  const name = dialog.getByLabel(/name/i);
  await expect(name).toHaveValue('Painted steel bracket (copy)');
  await name.fill('Bracket, recycled steel');
  await dialog.getByRole('button', 'Duplicate').tap();
  await expect(browser).toHaveURL(new RegExp(`/project/${projectId}/case/(?!${caseId}(?:\\D|$))\\d+`), { timeout: 30_000 });

  const cases = (await api.as(user.token).get<{ cases: Array<{ case_id: number; case_name: string }> }>(`/api/projects/${projectId}/cases`)).cases;
  expect(cases.map((c) => c.case_name)).toContain('Bracket, recycled steel');

  // "Compare Cases" is a guardrails §4 name on the project workspace.
  await app.open(`/project/${projectId}`);
  await screen.getByRole('button', 'Compare Cases').tap();
  await expect(browser).toHaveURL(`/project/${projectId}/comparison`, { timeout: 30_000 });
  await expect(screen.getByText('Compare cases').first()).toBeVisible();
  await expect(screen.getByRole('button', /^Bracket, recycled steel COPY/)).toHaveAttribute('aria-pressed', 'true');
  await expect(screen.getByText('Incomplete — not ranked')).toBeVisible();
  await expect(screen.getByText('Not run yet', { exact: false }).first()).toBeVisible();
  // The only ranked case is the base: no "Lowest …" verdict names the copy.
  await expect(screen.getByText(/Lowest Global Warming:\s*Bracket, recycled steel/)).toHaveCount(0);
});
