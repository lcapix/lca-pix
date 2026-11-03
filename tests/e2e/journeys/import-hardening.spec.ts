/**
 * From documents, walked as a student (V1 hardening 15 to 17; defects F1 to
 * F4 and B3 of the 2026-11-01 walk). Deterministic connectors only, on the
 * bundled sample files and the repo's fixtures (no AI, no network):
 *
 *   1. The three sample files into one case. Every Done card says what is
 *      next with one primary button, Goal and scope is set from the card, and
 *      the last one runs the case and lands on its results.
 *   2. The review is lean at 1440 x 900: the lines table fits its card, each
 *      line's edits are behind its own Edit, the steps editor only for a
 *      routing, "Next:" at the foot, and no "Sample loaded" toast left up.
 *   3. Leaving an open review asks first (browser back, the Back link,
 *      Start over) and does not spend a read.
 *   4. A held line keeps the step its file named; the Done card links to the
 *      Inventory where it is fixed; its match list has no pesticides for
 *      "Cardboard" and closes after a pick.
 */
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import { E2E_DIR } from '../support/paths';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };
const ROUTING = path.join(E2E_DIR, 'fixtures', 'import', 'small-routing.csv');
const BOM = path.join(E2E_DIR, 'fixtures', 'import', 'small-bom.csv');

async function newProject(api: any, token: string, name: string): Promise<number> {
  return (await api.as(token).post('/api/projects', { project_name: name, description: 'Import hardening' })).project.project_id as number;
}

/** Load the bundled sample of the chosen kind and read it. */
async function readSample(page: Page) {
  await page.getByRole('button', { name: 'Try it with a sample file' }).click();
  const preview = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
  await page.getByRole('button', { name: /^Check what we read/ }).click();
  expect((await preview).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible(NAV);
}

/** Save at the foot of the review, and wait for the Done card. */
async function save(page: Page, name: RegExp) {
  const apply = page.waitForResponse((r) => r.url().includes('/api/ingest/apply'), NAV);
  await page.getByRole('button', { name }).click();
  const res = await apply;
  expect(res.status(), await res.text()).toBeLessThan(300);
  await expect(page.getByRole('heading', { name: 'Where this case stands' })).toBeVisible(NAV);
  // The checklist has read the case.
  await expect(page.locator('.ip-stands')).toBeVisible(NAV);
  return (await res.json()) as any;
}

/** The lines table fits its card: no sideways scroll, names wider than a few letters. */
async function expectLean(page: Page) {
  const fit = page.locator('.ip-lines-table').locator('xpath=..');
  expect(await fit.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'the lines table fits its card').toBe(true);
  const nameCell = page.locator('.ip-lines-table tbody tr').first().locator('td').nth(1);
  expect((await nameCell.boundingBox())!.width, 'the name column is readable').toBeGreaterThan(150);
  // A line that is simply counted starts closed; one whose match needs a look
  // (no match, a match to check, no climate factor) starts open, so a wrong
  // read can be changed without hunting for it.
  for (const row of await page.locator('.ip-lines-table tbody tr.ip-line-row').all()) {
    const status = (await row.locator('.ip-status').innerText()).trim();
    await expect(row.locator('.ip-edit-toggle')).toHaveAttribute('aria-expanded', status === 'Counted' ? 'false' : 'true');
  }
  await expect(page.getByRole('region', { name: 'Next:' })).toBeVisible();
}

test('F1 F2 F4 three sample files into one case: each Done card says what is next, and the last one runs the case', async ({ api, newUser, signIn }) => {
  test.setTimeout(360_000);
  const user = await newUser('import-next');
  const projectId = await newProject(api, user.token, 'Touring bike study');
  const { page } = await signIn(user);

  // 1. The routing makes the case.
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });
  await page.getByRole('radio', { name: 'Routing' }).click();
  await readSample(page);
  // A routing shows its steps open, so a step read wrong can be changed at once; Close folds them.
  const editSteps = page.locator('button[aria-controls="ip-steps-edit"]');
  await expect(editSteps).toHaveText('Close the steps');
  await expect(editSteps).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel(/^Tier of /).first()).toBeVisible();
  await editSteps.click();
  await expect(page.getByLabel(/^Tier of /)).toHaveCount(0);
  await expect(editSteps).toHaveText('Edit the steps');
  await editSteps.click();
  await expect(page.getByLabel(/^Tier of /).first()).toBeVisible();
  // The labour cost the hours come to is shown, not "After save".
  await expect(page.getByRole('cell', { name: 'After save' })).toHaveCount(0);
  await expect(page.locator('.ip-steps-table tbody tr').first().locator('td').nth(4)).toHaveText(/^\$\d+\.\d\d$/);
  await page.getByLabel('Case name').fill('Touring bike');
  const routing = await save(page, /^Save \d+ steps to a new case$/);
  const caseId = Number(routing.case_id);
  const steps = Number(routing.components_created);
  // F4: the Done card's count is the tree's count.
  await expect(page.getByRole('status').filter({ hasText: `Saved. ${steps} steps are in Touring bike.` })).toBeVisible();
  await expect(page.locator('.ip-stands li', { hasText: 'Tree' })).toContainText(`${steps} steps`);
  // F1: Goal and scope "Not yet" is set right here, with its own Save.
  const scope = page.locator('.ip-stands li', { hasText: 'Goal and scope' });
  await expect(scope).toContainText('Not yet');
  await scope.getByRole('button', { name: 'Set the goal and scope' }).click();
  await scope.getByLabel('Functional unit').fill('1 touring bike');
  await scope.getByLabel('Functional unit').press('Enter'); // Enter never saves.
  expect((await api.as(user.token).get(`/api/projects/${projectId}`)).project.functional_unit || null).toBeNull();
  await scope.getByRole('button', { name: 'Save' }).click();
  await expect(scope).toContainText('Done', NAV);
  expect((await api.as(user.token).get(`/api/projects/${projectId}`)).project.functional_unit).toBe('1 touring bike');
  // The one primary: the next file.
  await expect(page.locator('.ip-done-next')).toContainText('Next: Add the bill of materials.');
  await page.getByRole('button', { name: 'Add the bill of materials →' }).click();

  // 2. The bill of materials, into the same case.
  await expect(page.getByRole('radio', { name: 'Bill of materials' })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Into', exact: true })).toHaveValue(String(caseId));
  await readSample(page);
  // F4: the "Sample loaded" toast closed when the review opened.
  await expect(page.getByText('Sample loaded. Press Check what we read.')).toHaveCount(0);
  // F2: no steps editor on a bill of materials added to a case; lean lines.
  await expect(page.getByRole('button', { name: 'Edit the steps' })).toHaveCount(0);
  await expectLean(page);
  // Change opens that line's match, amount, unit and step, then closes; a click on the row does the same.
  const pickers = page.locator('select[aria-label$="matches in the library"]');
  const before = await pickers.count();
  const aluRow = page.locator('.ip-lines-table tbody tr.ip-line-row').first();
  const editAlu = aluRow.locator('.ip-edit-toggle');
  await expect(editAlu).toHaveAccessibleName(/^Edit /);
  await expect(editAlu).toHaveText('Edit');
  await editAlu.click();
  await expect(pickers).toHaveCount(before + 1);
  await editAlu.click();
  await expect(pickers).toHaveCount(before);
  await aluRow.locator('.ip-line-name').click();
  await expect(pickers).toHaveCount(before + 1);
  await aluRow.locator('.ip-line-name').click();
  await expect(pickers).toHaveCount(before);
  const bom = await save(page, /^Save \d+ lines to Touring bike$/);
  expect(bom.flows_applied).toBeGreaterThan(10);
  // F4 (migrate-046): the step stays Production and no step is moved to Materials;
  // the materials it takes in count in Materials through their own flows.
  await expect(page.getByRole('note').filter({ hasText: /^Stage set to Materials on / })).toHaveCount(0);
  const comps = (await api.as(user.token).get(`/api/cases/${caseId}/components`)).components as any[];
  const cut = comps.find((c) => c.component_name === '10. Cut & miter frame tubes');
  expect(cut.life_cycle_stage).toBe('production');
  const bomInv = (await api.as(user.token).get(`/api/cases/${caseId}/inventory`)).rows as any[];
  const cutInputs = bomInv.filter((r) => r.component_id === cut.component_id && r.direction === 'input');
  expect(cutInputs.length).toBeGreaterThan(0);
  expect(cutInputs.map((r) => r.stage)).toEqual(cutInputs.map(() => 'materials'));
  await page.getByRole('button', { name: 'Add the equipment list →' }).click();

  // 3. The equipment list: electricity lines, short.
  await expect(page.getByRole('radio', { name: /Equipment list/ })).toBeChecked();
  await readSample(page);
  await expectLean(page);
  const review = await page.locator('.ip-review').boundingBox();
  expect(review!.height, 'the equipment review is not thousands of pixels tall').toBeLessThan(1800);
  // F4: electricity is energy use, not a material.
  await expect(page.getByRole('checkbox', { name: /as a material$/ })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /as energy use$/ }).first()).toBeVisible();
  await expect(page.locator('.ip-lines-foot')).toContainText('saved as energy use');
  const eq = await save(page, /^Save \d+ lines to Touring bike$/);
  expect(eq.flows_applied).toBeGreaterThan(0);

  // 4. Nothing left to add: the primary runs the case and lands on its results.
  await expect(page.locator('.ip-done-next')).toContainText('Next: Run the case.');
  await page.getByRole('button', { name: 'Run the case →' }).click();
  await expect(page).toHaveURL(new RegExp(`/project/${projectId}/case/${caseId}\\?tab=results`), NAV);
  const inv = await api.as(user.token).get(`/api/cases/${caseId}/inventory`);
  expect(inv.latest_run?.run_id, 'the case was run').toBeTruthy();
});

test('B3 leaving an open review asks first and spends no read', async ({ api, newUser, signIn }) => {
  test.setTimeout(240_000);
  const user = await newUser('import-leave');
  const projectId = await newProject(api, user.token, 'Leave study');
  const as = api.as(user.token);
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}`);
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });
  await page.getByRole('radio', { name: 'Routing' }).click();
  await page.locator('input[type="file"]').setInputFiles(ROUTING);
  const preview = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
  await page.getByRole('button', { name: /^Check what we read/ }).click();
  await preview;
  await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible(NAV);
  const reads = (await as.get('/api/ingest/reads-left')).remaining;
  const dialog = page.getByRole('alertdialog', { name: 'Leave this review?' });

  // Browser back: asked, and Keep reviewing keeps it.
  await page.goBack();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep reviewing' }).click();
  await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Keep 10. Cut tube' })).toBeChecked();
  // The Back link in the header.
  await page.getByRole('button', { name: 'Back to the project' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep reviewing' }).click();
  // Start over.
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible();
  // A link in the sidebar.
  await page.getByRole('link', { name: 'Home', exact: true }).first().click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep reviewing' }).click();
  await expect(page).toHaveURL(new RegExp(`/project/${projectId}/import`));
  // Nothing was read again.
  expect((await as.get('/api/ingest/reads-left')).remaining).toBe(reads);

  // Leave really leaves: browser back past the page, to where the project
  // opens (its Cases board: /project/:id replaces itself with it).
  await page.goBack();
  await dialog.getByRole('button', { name: 'Leave' }).click();
  await expect(page).toHaveURL(new RegExp(`/project/${projectId}/cases$`), NAV);
  expect((await as.get(`/api/projects/${projectId}/cases`)).cases ?? []).toHaveLength(0);
});

test('F3 a held line keeps its file\'s step, the Done card links to it, and its matches make sense', async ({ api, newUser, signIn }) => {
  test.setTimeout(300_000);
  const user = await newUser('import-held');
  const projectId = await newProject(api, user.token, 'Held line study');
  const as = api.as(user.token);
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });
  await page.getByRole('radio', { name: 'Routing' }).click();
  await page.locator('input[type="file"]').setInputFiles(ROUTING);
  const preview = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
  await page.getByRole('button', { name: /^Check what we read/ }).click();
  await preview;
  await page.getByLabel('Case name').fill('Tube frame');
  const routing = await save(page, /^Save \d+ steps to a new case$/);
  const caseId = Number(routing.case_id);
  await page.getByRole('button', { name: 'Add the bill of materials →' }).click();

  // The bill of materials, with Cardboard left unmatched: it is held.
  await page.getByLabel(/Drop a file here/).setInputFiles(BOM);
  const read = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
  await page.getByRole('button', { name: /^Check what we read/ }).click();
  await read;
  // A held line (no match) starts open; open it only if it is closed.
  const change = page.getByRole('button', { name: /^(Edit|Close) Cardboard$/ });
  if ((await change.getAttribute('aria-expanded')) !== 'true') await change.click();
  // Its step, from the file's Op Seq 30.
  const edits = page.getByRole('group', { name: 'Edits of Cardboard' });
  await expect(edits.getByRole('combobox', { name: 'Step this line is used at' }).locator('option:checked')).toHaveText('30. Pack');
  await page.getByLabel('What Cardboard matches in the library').selectOption('');
  await save(page, /^Save \d+ lines? to Tube frame$/);
  await expect(page.getByRole('list', { name: 'Held lines' })).toContainText('Cardboard');

  // The Done card links to where it is fixed.
  await page.getByRole('link', { name: 'Fix the held line in the Inventory' }).click();
  await expect(page).toHaveURL(new RegExp(`/case/${caseId}\\?tab=inventory#held-lines`), NAV);
  const held = page.locator('section[aria-labelledby="held-h"]');
  await expect(held).toBeVisible(NAV);
  // The step the file named, already chosen (not the skipped "Purchased materials").
  await expect(held.getByLabel('Step for Cardboard').locator('option:checked')).toHaveText('30. Pack');
  await expect(held).toContainText('the file says 30. Pack');

  // The matches: no pesticides, ranked, and the list closes after a pick.
  await held.getByLabel('Substance for Cardboard').fill('Cardboard');
  const matches = held.getByRole('list', { name: 'Matches for Cardboard' });
  await expect(matches).toBeVisible();
  await expect(matches).not.toContainText(/Carbaryl|Carbofuran|Carbosulfan|Carboxin|Mecarbam|Carbazole|Carbon tetrachloride/);
  await expect(matches.getByRole('button').first()).toHaveText(/^Cardboard · 100%/);
  await matches.getByRole('button').first().click();
  await expect(matches).toHaveCount(0);
  await held.getByRole('button', { name: 'Put on the step' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved · Cardboard on 30. Pack' })).toBeVisible(NAV);

  // Really on 30. Pack.
  const comps = (await as.get(`/api/cases/${caseId}/components`)).components as any[];
  const pack = comps.find((c) => c.component_name === '30. Pack');
  const flows = (await as.get(`/api/components/${pack.component_id}/flows`)).flows as any[];
  expect(flows.map((f) => [f.substance_name, Number(f.quantity), f.unit])).toContainEqual(['Cardboard', 0.5, 'kg']);
});
