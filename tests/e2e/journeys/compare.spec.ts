/**
 * F12: a what-if from Results, then Compare. A copy with no run fails the
 * fourth check, so the totals are greyed and change by step is held back
 * (E09b); the check's one action runs it, and the comparison is fair.
 * docs/flows/USER_FLOWS.md §F12, on the education screens.
 */
import { openCase, workedExample } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };

test('F12 Try a what-if from Results → Compare: "no run" fails a check until the copy is run', async ({ api, newUser, signIn }) => {
  const user = await newUser('compare');
  const { projectId, caseId } = await workedExample(api, user, 'My bracket');
  await api.as(user.token).post(`/api/cases/${caseId}/assessments`, { run_name: 'Assessment' });

  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await page.getByRole('tab', { name: /^Results/ }).click();
  await expect(page.getByText('What builds this number')).toBeVisible(NAV);

  const duplicated = page.waitForResponse((r) => r.url().includes(`/api/cases/${caseId}/duplicate`), NAV);
  await page.getByRole('button', { name: 'Try a what-if' }).click();
  const res = await duplicated;
  expect(res.status()).toBe(201);
  const copyId = (await res.json()).case_id as number;
  await expect(page).toHaveURL(new RegExp(`/project/${projectId}/case/${copyId}`), NAV);

  await open(page, `/project/${projectId}/comparison?cases=${caseId},${copyId}`, { ready: 'Not comparable yet' });
  await expect(page.getByText('1 of 4 checks fails')).toBeVisible();
  await expect(page.getByText('Fails: A case has no run')).toBeVisible();
  await expect(page.getByText('Not run yet').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Change by step shows once every check passes' })).toBeVisible();

  // The check's action runs the copy under A's method and region.
  const ran = page.waitForResponse((r) => r.url().includes(`/api/cases/${copyId}/assessments`) && r.request().method() === 'POST', NAV);
  await page.getByRole('button', { name: /^Run What-if 1 of My bracket$/ }).first().click();
  expect((await ran).status()).toBe(201);
  await expect(page.getByText('Fair to compare')).toBeVisible(NAV);
  await expect(page.getByRole('heading', { name: 'Change by step' })).toBeVisible();
  // Nothing differs yet, and the panel says so.
  await expect(page.getByText(/^Nothing in What-if 1 of My bracket differs from My bracket\./)).toBeVisible();
});
