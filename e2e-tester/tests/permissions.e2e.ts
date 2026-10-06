/**
 * F14: a signed-in account that is not a member of a project gets "not found"
 * for it and sees none of its data. docs/flows/USER_FLOWS.md §F14 and
 * docs/flows-updates/permissions-404.md (same journey as the "non-member" test
 * in tests/e2e/journeys/permissions.spec.ts).
 */
import { ApiError, workedExample } from '../support/api.ts';
import { toasts } from '../support/editor.ts';
import { expect, test } from '../support/fixtures.ts';

test('a non-member opening another user’s project gets "Project not found" and none of its data', async ({ app, screen, browser, api, newUser, signIn }) => {
  const owner = await newUser('owner', { fullName: 'Olga Owner' });
  const stranger = await newUser('stranger', { fullName: 'Sid Stranger' });
  const { projectId, caseId } = await workedExample(api, owner);

  const refused = await api.as(stranger.token).get(`/api/projects/${projectId}`).catch((e: unknown) => e);
  expect(refused instanceof ApiError).toBe(true);
  expect((refused as ApiError).status).toBe(404);

  await signIn(stranger, `/project/${projectId}`);
  // first(): in dev, React runs the page's load effect twice, so the toast can show twice.
  await expect(toasts(screen).getByText('Project not found').first()).toBeVisible({ timeout: 60_000 });
  // …and is sent back to their own dashboard.
  await expect(browser).toHaveURL('/home', { timeout: 30_000 });
  await expect(screen.getByRole('button', 'Open the worked example')).toBeVisible();
  await expect(screen.getByText('Example: painted steel bracket')).toHaveCount(0);

  await app.open(`/project/${projectId}/case/${caseId}`);
  // The editor's not-found state (a toast says it too, hence first(): the page's own line comes first).
  await expect(screen.getByRole('button', 'Return to Home')).toBeVisible({ timeout: 60_000 });
  await expect(screen.getByText('Case not found').first()).toBeVisible();
  await expect(screen.getByText('Painted steel bracket')).toHaveCount(0);
  await expect(screen.getByText('10. Cut blank')).toHaveCount(0);
});
