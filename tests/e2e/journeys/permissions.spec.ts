/**
 * F14 roles in the UI: a member who can change, a viewer member and a
 * non-member. docs/flows/USER_FLOWS.md §F14 and docs/flows-updates/permissions-404.md.
 * Seeded: Victor Viewer is a viewer on the bracket study (P1) and not a
 * member of the five-tier project (P2).
 */
import { ApiError } from '../support/api';
import { openCase, workedExample } from '../support/editor';
import { expect, storagePath, test } from '../support/fixtures';
import { open, settle } from '../support/ui';

const NAV = { timeout: 90_000 };

test.describe('member who can change', () => {
  test("reaches the owner's base case with Run Assessment and Add step", async ({ api, newUser, signIn }) => {
    const owner = await newUser('canchange-owner');
    const member = await newUser('canchange-member');
    const { projectId, baseCaseId } = await workedExample(api, owner);
    await api.as(owner.token).post(`/api/projects/${projectId}/members`, { email: member.email, role: 'editor' });

    const { page } = await signIn(member);
    await openCase(page, projectId, baseCaseId);
    await expect(page.getByRole('button', { name: 'Run Assessment', exact: true })).toBeVisible(NAV);
    await expect(page.getByRole('button', { name: 'Add step', exact: true })).toBeVisible();
    await expect(page.getByText('Can read', { exact: true })).toHaveCount(0);
  });
});

test.describe('viewer member', () => {
  test.use({ storageState: storagePath('viewer') });

  test('can open the project, the case and its Results', async ({ page, seed }) => {
    const { projectId, baseCaseId, projectName } = seed.example;
    await open(page, `/project/${projectId}`);
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^${projectName}`) })).toBeVisible(NAV);

    await openCase(page, projectId, baseCaseId);
    await expect(page.getByRole('treeitem', { name: /^10\. Cut blank, / })).toBeVisible();

    await open(page, `/project/${projectId}/case/${baseCaseId}?tab=results`, { ready: 'What builds this number' });
    await expect(page.locator('.ws-answer-num')).toHaveText('1.72');
  });

  test('sees no edit controls: no run, no Add step; says Can read', async ({ page, seed }) => {
    const { projectId, baseCaseId } = seed.example;
    await openCase(page, projectId, baseCaseId);
    await expect(page.getByText('Can read', { exact: true }).first()).toBeVisible();
    for (const name of ['Run Assessment', 'Add step']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
  });

  test('an edit sent anyway is refused by the server and nothing changes', async ({ seed, api }) => {
    const { cutBlankId } = seed.example;
    const err = await api
      .as(seed.users.viewer.token)
      .put(`/api/components/${cutBlankId}`, { overhead_cost: 99 })
      .then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    const row = (await api.as(seed.users.owner.token).get<{ component: { overhead_cost: unknown } }>(`/api/components/${cutBlankId}`)).component;
    expect(row.overhead_cost).toBeNull();
  });
});

test.describe('non-member', () => {
  test.use({ storageState: storagePath('viewer') });

  test('another user’s project URL says it is not here, and shows none of its data', async ({ page, seed, api }) => {
    const { projectId, caseId, projectName } = seed.fiveTier;
    // The server: 404, as for a project that does not exist.
    const err = await api
      .as(seed.users.viewer.token)
      .get(`/api/projects/${projectId}`)
      .then(() => null, (e: unknown) => e);
    expect((err as ApiError).status).toBe(404);

    await page.goto(`/project/${projectId}`);
    await expect(page.getByText('This project is not here. It may have been deleted, or it is not shared with you.')).toBeVisible(NAV);
    await expect(page.getByText(projectName)).toHaveCount(0);

    await page.goto(`/project/${projectId}/case/${caseId}`);
    await settle(page);
    await expect(page.getByText('This case is not here. It may have been deleted, or it is not shared with you.')).toBeVisible(NAV);
    await expect(page.getByText('Frame build')).toHaveCount(0);
    await expect(page.getByText('Bicycle frame')).toHaveCount(0);
  });
});
