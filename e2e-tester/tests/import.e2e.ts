/**
 * F13: import a small routing CSV → review the extracted model → apply → open
 * the new case. Deterministic connector only (no AI, no network).
 * docs/flows/USER_FLOWS.md §F13 (same journey as tests/e2e/journeys/import.spec.ts).
 */
import { components, workedExample } from '../support/api.ts';
import { outline } from '../support/editor.ts';
import { expect, test } from '../support/fixtures.ts';

const OPERATIONS = ['Cut tube', 'Weld frame', 'Pack'];

test('import a routing CSV → review → apply → open the created case', async ({ screen, browser, api, newUser, signIn }) => {
  const user = await newUser('import');
  const { projectId } = await workedExample(api, user);
  await signIn(user, `/project/${projectId}/import`);
  await expect(screen.getByText('Import a document').first()).toBeVisible({ timeout: 60_000 });

  // The DOCUMENT TYPE and ADD TO selects have no accessible name (their
  // captions are not labels): they are the first two comboboxes on the page.
  await screen.getByRole('combobox').nth(0).selectOption({ label: 'Process routing / Bill of Process (deterministic)' });
  await screen.getByRole('combobox').nth(1).selectOption({ label: 'Create a new case' });
  await browser.locator('input[type="file"]').setInputFiles(['fixtures/small-routing.csv']);
  await screen.getByPlaceholder('e.g. product name').fill('Tube frame');
  await screen.getByRole('button', 'Preview extraction').tap();

  // Review: the three operations ("10. Cut tube", …) are listed before anything is written.
  await expect(screen.getByText('CASE NAME')).toBeVisible({ timeout: 30_000 });
  for (const op of OPERATIONS) await expect(screen.getByText(new RegExp(`^\\d+\\. ${op}$`)).first()).toBeVisible();
  const before = (await api.as(user.token).get<{ cases: unknown[] }>(`/api/projects/${projectId}/cases`)).cases.length;

  await screen.getByRole('button', 'Apply — create this case').tap();
  await expect(screen.getByText('Case created from document')).toBeVisible({ timeout: 30_000 });
  const cases = (await api.as(user.token).get<{ cases: Array<{ case_id: number }> }>(`/api/projects/${projectId}/cases`)).cases;
  expect(cases.length).toBe(before + 1);
  const created = Math.max(...cases.map((c) => c.case_id));
  // The product plus the three operations.
  expect((await components(api, user, created)).length).toBeGreaterThanOrEqual(4);

  await screen.getByRole('button', 'Open case').tap();
  await expect(browser).toHaveURL(new RegExp(`/project/${projectId}/case/${created}(?:$|[/?#])`), { timeout: 30_000 });
  await expect(screen.getByTestId('tree-canvas-viewport')).toBeVisible({ timeout: 60_000 });
  for (const op of OPERATIONS) await expect(outline(screen).getByRole('button', new RegExp(`${op}$`))).toBeVisible();
});
