/**
 * F13: add a small routing CSV → check what we read → save → open the tree.
 * docs/flows/USER_FLOWS.md §F13, on the education screens (F2.2, F2.3,
 * F2.4). Deterministic connector only (no AI, no network).
 */
import path from 'node:path';
import { expect, test } from '../support/fixtures';
import { E2E_DIR } from '../support/paths';
import { open } from '../support/ui';

const CSV = path.join(E2E_DIR, 'fixtures', 'import', 'small-routing.csv');
const NAV = { timeout: 90_000 };
const OPS = ['10. Cut tube', '20. Weld frame', '30. Pack'];

test('F13 add a routing → check what we read → save 3 steps → open the tree', async ({ api, newUser, signIn }) => {
  const user = await newUser('import');
  const as = api.as(user.token);
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Tube frame study', description: 'Import check' }))
    .project.project_id;
  await as.put(`/api/projects/${projectId}`, { lcia_method: 'TRACI 2.1', region_code: 'US', functional_unit: '1 tube frame' });

  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });
  await page.getByRole('radio', { name: 'Routing' }).click();
  await page.locator('input[type="file"]').setInputFiles(CSV);

  const preview = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
  await page.getByRole('button', { name: /^Check what we read/ }).click();
  expect((await preview).status()).toBe(200);

  // Nothing is written before Save: every step is listed and ticked first.
  await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible(NAV);
  await expect(page.getByText('Nothing is saved until you press Save.', { exact: false })).toBeVisible();
  for (const op of OPS) await expect(page.getByRole('checkbox', { name: `Keep ${op}` })).toBeChecked();
  await page.getByLabel('Case name').fill('Tube frame');

  const apply = page.waitForResponse((r) => r.url().includes('/api/ingest/apply'), NAV);
  await page.getByRole('button', { name: 'Save 3 steps to a new case' }).click();
  const applied = await apply;
  expect(applied.status()).toBe(201);
  const { case_id: caseId, components_created: created } = (await applied.json()) as { case_id: number; components_created: number };
  expect(created).toBeGreaterThanOrEqual(4); // the product + three operations

  await expect(page.getByText(/^Saved\./)).toBeVisible(NAV);
  await page.getByRole('button', { name: 'Open the tree' }).click();
  await expect(page).toHaveURL(new RegExp(`/project/${projectId}/case/${caseId}`), NAV);
  await expect(page.getByRole('tree')).toBeVisible(NAV);
  for (const op of OPS) await expect(page.getByRole('treeitem', { name: new RegExp(`^${op.replace('.', '\\.')}, `) })).toBeVisible();
});
