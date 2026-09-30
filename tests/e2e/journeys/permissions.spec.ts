/**
 * F14 roles in the UI: a viewer member and a non-member.
 * docs/flows/USER_FLOWS.md §F14 and docs/flows-updates/permissions-404.md.
 * Seeded: Victor Viewer is a viewer on the worked example (P1) and not a
 * member of the five-tier project (P2).
 */
import { inspector, openCase, openSection, selectComponent } from '../support/editor';
import { expect, storagePath, test } from '../support/fixtures';
import { expectToast, open, settle } from '../support/ui';

test.describe('viewer member', () => {
  test.use({ storageState: storagePath('viewer') });

  test('can open the workspace, the case and the results', async ({ page, seed }) => {
    const { projectId, baseCaseId, projectName } = seed.example;
    await open(page, `/project/${projectId}`);
    await expect(page.getByRole('heading', { level: 1, name: projectName })).toBeVisible();

    await openCase(page, projectId, baseCaseId);
    await expect(page.getByRole('button', { name: /^\S 10\. Cut blank$/ })).toBeVisible();

    await open(page, `/project/${projectId}/case/${baseCaseId}/results`, { ready: 'TOTAL IMPACT' });
    await expect(page.getByText('1.72', { exact: true }).first()).toBeVisible();
  });

  // No role-based UI exists yet (USER_FLOWS §0.3 "No role-based UI"): the
  // editor, workspace and results show Add Component, Run Assessment,
  // Duplicate, Save, Delete, Add Case and Delete project to a viewer, and each
  // one only fails with a 403 when clicked. Enable once the UI reads the role.
  test.fixme('sees no edit controls', async ({ page, seed }) => {
    const { projectId, baseCaseId } = seed.example;
    await openCase(page, projectId, baseCaseId);
    for (const name of ['Add Component', 'Run Assessment', 'Duplicate', 'Save', 'Delete']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await open(page, `/project/${projectId}`);
    for (const name of ['Add Case', 'Delete', 'Import Data']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
  });

  test('an edit is refused by the server and nothing changes', async ({ page, seed, api }) => {
    const { projectId, baseCaseId, cutBlankId } = seed.example;
    await openCase(page, projectId, baseCaseId);
    await selectComponent(page, '10. Cut blank');
    const overhead = inspector(page).getByRole('textbox', { name: 'Overhead cost' });
    await openSection(page, 'Costs', overhead);
    await overhead.fill('99');
    const put = page.waitForResponse((r) => r.url().includes(`/api/components/${cutBlankId}`) && r.request().method() === 'PUT');
    await inspector(page).getByRole('button', { name: 'Save', exact: true }).click();
    expect((await put).status()).toBe(403);
    await expectToast(page, /permission|not allowed|forbidden|access/i);

    const row = (await api.as(seed.users.owner.token).get<{ component: { overhead_cost: unknown } }>(`/api/components/${cutBlankId}`)).component;
    expect(row.overhead_cost).toBeNull();
  });
});

test.describe('non-member', () => {
  test.use({ storageState: storagePath('viewer') });

  test('opening another user’s project URL shows "not found" and none of its data', async ({ page, seed }) => {
    const { projectId, caseId, projectName } = seed.fiveTier;
    const res = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/projects/${projectId}`);
    await page.goto(`/project/${projectId}`);
    expect((await res).status()).toBe(404);
    await expectToast(page, 'Project not found');
    await settle(page);
    await expect(page.getByText(projectName)).toHaveCount(0);

    await page.goto(`/project/${projectId}/case/${caseId}`);
    await settle(page);
    await expect(page.getByText('Frame build')).toHaveCount(0);
    await expect(page.getByText('Bicycle frame')).toHaveCount(0);
  });
});
