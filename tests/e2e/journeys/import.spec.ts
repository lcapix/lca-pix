/**
 * F13: import a small routing CSV → review the extracted model → apply →
 * open the new case. docs/flows/USER_FLOWS.md §F13. Deterministic connector
 * only (no AI, no network).
 */
import path from 'node:path';
import { workedExample } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { E2E_DIR } from '../support/paths';
import { open } from '../support/ui';

const CSV = path.join(E2E_DIR, 'fixtures', 'import', 'small-routing.csv');

test('F13 import a routing CSV → review → apply → open the created case', async ({ api, newUser, signIn }) => {
  const user = await newUser('import');
  const { projectId } = await workedExample(api, user);
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/import`, { ready: 'Import a document' });

  // The DOCUMENT TYPE and ADD TO selects have no accessible name (their
  // captions are not labels): they are the first two comboboxes on the page.
  const docType = page.getByRole('combobox').nth(0);
  await docType.selectOption({ label: 'Process routing / Bill of Process (deterministic)' });
  await page.getByRole('combobox').nth(1).selectOption({ label: 'Create a new case' });
  await page.locator('input[type="file"]').setInputFiles(CSV);
  await page.getByPlaceholder('e.g. product name').fill('Tube frame');

  const preview = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'));
  await page.getByRole('button', { name: 'Preview extraction' }).click();
  expect((await preview).status()).toBe(200);

  // Review: the three operations are listed before anything is written.
  await expect(page.getByText('CASE NAME')).toBeVisible();
  for (const op of ['Cut tube', 'Weld frame', 'Pack']) await expect(page.getByText(op).first()).toBeVisible();

  const apply = page.waitForResponse((r) => r.url().includes('/api/ingest/apply'));
  await page.getByRole('button', { name: 'Apply — create this case' }).click();
  const applied = await apply;
  expect(applied.status()).toBe(201);
  const { case_id: caseId, components_created: created } = (await applied.json()) as { case_id: number; components_created: number };
  expect(created).toBeGreaterThanOrEqual(4); // the product + three operations

  await expect(page.getByText('Case created from document')).toBeVisible();
  await page.getByRole('button', { name: 'Open case' }).or(page.getByRole('link', { name: 'Open case' })).first().click();
  await expect(page).toHaveURL(new RegExp(`/project/${projectId}/case/${caseId}`));
  await expect(page.getByTestId('tree-canvas-viewport')).toBeVisible();
  const outline = page.getByRole('complementary').filter({ has: page.getByRole('textbox', { name: 'Components' }) });
  for (const op of ['Cut tube', 'Weld frame', 'Pack']) {
    await expect(outline.getByRole('button', { name: new RegExp(`${op}$`) })).toBeVisible();
  }
});
