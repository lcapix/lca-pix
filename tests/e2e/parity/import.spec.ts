/**
 * Kept and moved rows of import. The pick form, case name, save and the done
 * card (P92, P94, P95, P96) are exercised by the import journey.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import { test } from '../support/fixtures';
import { E2E_DIR } from '../support/paths';
import { row } from '../support/parity';
import { open } from '../support/ui';

const BOM = path.join(E2E_DIR, 'fixtures', 'import', 'small-bom.csv');
const NAV = { timeout: 90_000 };

test('I01 P89 P90 P91 P93 P97 P98 matches, a name clash, the status card, append, the sample and a failed read', async ({
  api,
  newUser,
  signIn,
  seed,
}) => {
  test.setTimeout(180_000);
  const user = await newUser('parity-import');
  const as = api.as(user.token);
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Parity import', description: 'Import checks' }))
    .project.project_id;
  const base = (
    await as.post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, {
      case_name: 'Base case',
      case_type: 'base',
      description: 'Already here',
    })
  ).case.case_id;
  await as.post(`/api/cases/${base}/components`, {
    component_name: 'Bracket',
    component_type: 'product',
    parent_component_id: null,
    quantity: 1,
    unit: 'unit',
  });

  const owner = await signIn(seed.users.owner);
  await open(owner.page, `/project/${seed.example.projectId}/import`, { ready: 'What kind of file is it?' });
  await row(owner.page.getByText(/DOCUMENTS & DATA ADDED SO FAR/), 'P91', 'Project status card');
  await owner.context.close();

  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });

  await page.getByRole('button', { name: 'Read the sample file' }).click();
  await row(page.getByRole('dialog'), 'P97', 'Sample dialog (load, download, copy)');
  await page.getByRole('dialog').click({ position: { x: 8, y: 8 } });

  await page.getByRole('radio', { name: 'Bill of materials' }).click();
  await page.getByLabel(/Drop a file here/).setInputFiles(BOM);
  await page.getByRole('combobox', { name: 'Into', exact: true }).selectOption({ label: 'Base case' });
  const preview = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
  await page.getByRole('button', { name: /Check what we read/ }).click();
  expectOk(await preview);
  await row(page.getByText(/% match|best \d+%/), 'I01', 'Candidate matches with % score');
  await row(page.getByText(/Place every line on a step first/), 'P93', 'Append banner with unplaced count');

  await row(page.getByRole('banner').getByRole('button', { name: /^Back to the (case|project)$/ }).or(page.getByRole('button', { name: /^Back to the (case|project)$/ })).first(), 'P90', 'Back in the header on every step');
  // Start over throws the read away, so it asks first (B3).
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Leave this review?' }).getByRole('button', { name: 'Leave' }).click();
  await page.route(/\/api\/ingest\/preview/, (route) =>
    route.fulfill({
      status: 415,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unsupported file type', matching_ids: ['WV0661'] }),
    }),
  );
  await page.getByLabel(/Drop a file here/).setInputFiles(BOM);
  await page.getByRole('combobox', { name: 'Into', exact: true }).selectOption({ label: 'A new case' });
  await page.getByRole('button', { name: /Check what we read/ }).click();
  await row(page.getByText('Matching IDs in this workbook: WV0661'), 'P98', 'Error card with ID hints');
  await page.getByRole('button', { name: 'Start empty instead' }).click();
  await page.waitForURL(new RegExp(`/project/${projectId}/case/${base}$`), NAV);
  await row(page.getByRole('tree'), 'P89', 'Base case name clash (409)');
});

function expectOk(res: { status(): number }) {
  if (res.status() >= 400) throw new Error(`preview answered ${res.status()}`);
}

/** The repo's BOM fixture with both lines respelled: a spelling test made from it (I04). */
function respelledBom() {
  const csv = readFileSync(BOM, 'utf8').replace('Aluminum', 'Aluminium sheet').replace('Cardboard', 'Stainless steel 304');
  return { name: 'small-bom.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) };
}

async function traciProject(api: { as(t: string): any }, token: string, name: string): Promise<number> {
  const as = api.as(token);
  const id = (await as.post('/api/projects', { project_name: name, description: 'Import checks' })).project.project_id as number;
  await as.put(`/api/projects/${id}`, { lcia_method: 'TRACI 2.1', region_code: 'US' });
  return id;
}

test('I02 I03 I04 I05 I06 I07 I08 I10 I11 a respelled bill of materials into a TRACI 2.1 project, at 1024 px, then its held line', async ({
  api,
  newUser,
  signIn,
}) => {
  test.setTimeout(240_000);
  const user = await newUser('parity-import-lines');
  const projectId = await traciProject(api, user.token, 'Spelling import');
  const { page } = await signIn(user);
  await page.setViewportSize({ width: 1024, height: 768 });
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });
  await page.getByRole('radio', { name: 'Bill of materials' }).click();
  await page.getByLabel(/Drop a file here/).setInputFiles(respelledBom());
  const preview = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
  await page.getByRole('button', { name: /Check what we read/ }).click();
  expectOk(await preview);

  // A line's match, amount and unit sit behind its own Edit (F2).
  // A line that needs a check starts open; open it only if it is closed.
  const aluToggle = page.getByRole('button', { name: /^(Edit|Close) Aluminium sheet$/ });
  if ((await aluToggle.getAttribute('aria-expanded')) !== 'true') await aluToggle.click();
  const alu = page.getByLabel('What Aluminium sheet matches in the library');
  await expect.soft(alu.locator('option:checked'), 'I04 "Aluminium sheet" lands on the library\'s Aluminum').toHaveText(/^Aluminum · /);
  await row(page.getByText('Each match shows its climate factor in TRACI 2.1'), 'I02', 'Factors shown for the project\'s method');
  await expect.soft(alu.locator('option:checked'), 'I02 factor, unit, variant and source on the candidate').toHaveText(/· 8\.6 kg CO2 eq · .* · Global · International Aluminium Institute/);
  // 759aaa2: the direction is on the line itself ("Input · small-bom.csv"), not a column of its own.
  await row(page.locator('tr', { hasText: 'Aluminium sheet' }).getByText(/^Input · /).first(), 'I05', 'Direction on each line');
  await row(page.locator('tr', { hasText: 'Aluminium sheet' }).getByText(/small-bom\.csv/), 'I05', 'Full provenance');
  await row(page.getByText(/matched 'Aluminum' \(substance \d+\)/), 'I06', 'Substance id in the review notes');

  // I10 (finding 3.6): the lines table fits its card at 1024 px.
  const wrap = page.locator('.ip-lines-table').locator('xpath=..');
  expect.soft(await wrap.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'I10 the lines table fits its card at 1024 px').toBe(true);

  // I03: beyond the top 3, the whole library.
  const before = await alu.locator('option').count();
  await page.getByRole('group', { name: 'Edits of Aluminium sheet' }).getByRole('button', { name: 'Search the whole library' }).click();
  await expect.soft(alu.locator('option'), 'I03 the whole library is searched').not.toHaveCount(before);
  expect.soft(await alu.locator('option').count(), 'I03 more than the top 3').toBeGreaterThan(4);

  // I07: hold the stainless line, save, and the saved card lists it.
  await page.getByRole('button', { name: 'Edit Stainless steel 304' }).click();
  await page.getByLabel('What Stainless steel 304 matches in the library').selectOption('');
  await page.getByLabel('Case name').fill('Respelled');
  const applied = page.waitForResponse((r) => r.url().includes('/api/ingest/apply'), NAV);
  await page.getByRole('button', { name: /^Save / }).click();
  const caseId = Number((await (await applied).json()).case_id);
  await row(page.getByRole('list', { name: 'Held lines' }).getByText(/Stainless steel 304/), 'I07', 'Held lines listed one by one after Save');
  const savedLine = page.getByRole('status').filter({ hasText: /^Saved\./ });
  await expect(savedLine, 'I11 the saved line is there').toHaveCount(1);
  await expect.soft(savedLine, 'I11 no "and their hours" when no hours were read').not.toContainText('and their hours');
  const stepCounts = (await savedLine.innerText()).match(/\b\d+ steps?\b/g) ?? [];
  expect.soft(stepCounts.length, 'I11 one step count, not two').toBeLessThanOrEqual(1);

  // I08: the held line, picked in the case, shows scores and factors from the whole library.
  await open(page, `/project/${projectId}/case/${caseId}?tab=inventory`);
  const held = page.locator('section[aria-labelledby="held-h"]');
  await held.getByLabel('Substance for Stainless steel 304').fill('Aluminium');
  await row(held.getByRole('list', { name: 'Matches for Stainless steel 304' }).getByText(/^Aluminum · \d+% · 8\.6 kg CO2 eq/), 'I08', 'Held line: candidates with scores and factors');
  await held.getByLabel('Substance for Stainless steel 304').fill('Stainless');
  await row(held.getByRole('list', { name: 'Matches for Stainless steel 304' }).getByText(/^Stainless Steel · \d+% · 6\.15 kg CO2 eq/), 'I08', 'Held line: the whole library, past the first 500');
});

test('I12 Into starts on the project\'s case, and the equipment list opens once that case has steps', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-import-into');
  const as = api.as(user.token);
  const projectId = (await as.post('/api/projects', { project_name: 'Into', description: 'Into default' })).project.project_id as number;
  const caseId = (await as.post(`/api/projects/${projectId}/cases`, { case_name: 'Base case', case_type: 'base', description: 'Here' })).case.case_id as number;
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });
  await expect.soft(page.getByRole('combobox', { name: 'Into', exact: true }), 'I12 Into starts on the project\'s case').toHaveValue(String(caseId));
  await expect.soft(page.getByRole('radio', { name: /Equipment list/ }), 'I12 equipment waits for a case with steps').toBeDisabled();
  // The product step alone holds nothing to size: the equipment list needs a step below it.
  const product = (await as.post(`/api/cases/${caseId}/components`, { component_name: 'Bracket', component_type: 'product', parent_component_id: null, quantity: 1, unit: 'unit' })).component.component_id as number;
  await as.post(`/api/cases/${caseId}/components`, { component_name: 'Press line', component_type: 'machine_line', parent_component_id: product, quantity: 1, unit: 'unit' });
  await page.reload();
  await page.getByRole('combobox', { name: 'Into', exact: true }).selectOption(String(caseId));
  await expect.soft(page.getByRole('radio', { name: /Equipment list/ }), 'I12 equipment opens once the case has steps').toBeEnabled();
});

const ITAC_WORKBOOK = process.env.ITAC_WORKBOOK || path.join(homedir(), 'lca', 'corpus', 'itac', 'ITAC_Database_20260830.xlsx');

test('I09 DOE\'s ITAC workbook imports as downloaded: WV0661 reaches review with $78,053 of electricity and $23,097 of gas', async ({ api, newUser, signIn }) => {
  test.skip(!existsSync(ITAC_WORKBOOK), `no workbook at ${ITAC_WORKBOOK}; set ITAC_WORKBOOK`);
  test.setTimeout(240_000);
  const user = await newUser('parity-import-itac');
  const projectId = (await api.as(user.token).post('/api/projects', { project_name: 'ITAC', description: 'WV0661' })).project.project_id as number;
  const { page } = await signIn(user);
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });
  await page.getByRole('radio', { name: 'ITAC assessment' }).click();
  await page.getByLabel(/Drop a file here/).setInputFiles(ITAC_WORKBOOK);
  await page.getByPlaceholder('e.g. WV0661').fill('WV0661');
  const preview = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), { timeout: 180_000 });
  await page.getByRole('button', { name: /Check what we read/ }).click();
  const res = await preview;
  expectOk(res);
  // The browser sent the plant's row, not the 16.8 MB workbook.
  const sent = res.request().postDataBuffer()?.length ?? Number.POSITIVE_INFINITY;
  expect.soft(sent, 'I09 the upload is the row, not the workbook').toBeLessThan(4_500_000);
  await expect(page.getByText('Electricity $78,053 · Natural gas $23,097')).toBeVisible(NAV);
});
