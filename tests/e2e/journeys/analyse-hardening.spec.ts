/**
 * Journey 5, Analyse (hardening list 23 to 26), walked the way a student does
 * it and checked by its outcome: the numbers on screen and the text of the
 * exported PDF. Defects A3 A4 A5 A6 A8 C2 G1 G2, the hand-in step and the
 * unsaved write-up guard (docs: research/v1-walk-defects-2026-11-01.md).
 *
 * Setup that is not under test goes through the API: the sample study, a copy
 * with Steel 0.80 → 0.70 kg on "10. Cut blank", and runs under a given method
 * and region. The sample reads 1.720 kg CO2 eq, Acidification 0.001 kg SO2 eq
 * and $1.75; the copy reads 1.530, 11.0% lower.
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { Api, ApiUser } from '../support/api';
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

const NAV = { timeout: 90_000 };

interface Study {
  projectId: number;
  baseId: number;
  copyId: number;
}

/** The sample study and a copy of its base case with Steel 0.70 kg (the walk's comparative case). */
async function sampleWithLighterSteel(api: Api, user: ApiUser, copyName = 'My copy'): Promise<Study> {
  const as = api.as(user.token);
  const ex = await as.post<{ project_id: number; case_id: number }>('/api/example-project');
  const copy = await as.post<{ case_id: number }>(`/api/cases/${ex.case_id}/duplicate`, { case_name: copyName });
  const comps = (await as.get<{ components: Array<{ component_id: number; component_name: string }> }>(`/api/cases/${copy.case_id}/components`)).components;
  const cut = comps.find((c) => c.component_name === '10. Cut blank')!;
  const flows = (await as.get<{ flows: Array<{ flow_id: number; substance_name?: string; name?: string }> }>(`/api/components/${cut.component_id}/flows`)).flows;
  const steel = flows.find((f) => (f.substance_name ?? f.name) === 'Steel')!;
  await as.put(`/api/flows/${steel.flow_id}`, { quantity: 0.7 });
  return { projectId: ex.project_id, baseId: ex.case_id, copyId: copy.case_id };
}

/** A request to /api/cases/:id itself (the client adds a ?_t= cache-buster). */
const isCase = (url: string, id: number) => new URL(url).pathname === `/api/cases/${id}`;

async function runAs(api: Api, user: ApiUser, caseId: number, method: string, region: string): Promise<number> {
  const r = await api.as(user.token).post<{ run_id: number }>(`/api/cases/${caseId}/assessments`, {
    run_name: 'Assessment',
    calculation_method: method,
    region_code: region,
  });
  return r.run_id;
}

/** Every percentage on the page's Compare area, as text. */
async function percentages(page: Page): Promise<string[]> {
  const text = await page.locator('.cmp').innerText();
  return text.match(/\d+(\.\d+)?\s?%/g) ?? [];
}

async function pdfText(bytes: Buffer): Promise<string> {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    pages.push(content.items.map((i: any) => (i.str ?? '') + (i.hasEOL ? '\n' : ' ')).join(''));
  }
  return pages.join('\n').replace(/[ \t]+/g, ' ');
}

async function exportPdf(page: Page): Promise<string> {
  await page.getByRole('radio', { name: 'PDF', exact: true }).click();
  const download = page.waitForEvent('download', NAV);
  const response = page.waitForResponse((r) => r.url().includes('/export?format=pdf'), NAV);
  await page.getByRole('button', { name: 'Export the report' }).click();
  expect((await response).status()).toBe(200);
  return pdfText(readFileSync((await (await download).path())!));
}

test('A3 A4: Compare prints one percentage when the runs compare, none across regions or methods, and the fix reruns B', async ({ api, newUser, signIn }) => {
  const user = await newUser('analyse');
  const s = await sampleWithLighterSteel(api, user);
  await runAs(api, user, s.copyId, 'TRACI 2.1', 'US');
  const { page } = await signIn(user);
  const comparison = `/project/${s.projectId}/comparison?cases=${s.baseId},${s.copyId}`;

  // Same method and region: 1.720 against 1.530, and 11.0% in every place that prints a percentage.
  await open(page, comparison, { ready: 'Fair to compare' });
  const totals = page.getByRole('region', { name: 'Totals' });
  await expect(totals).toContainText('1.720');
  await expect(totals).toContainText('1.530');
  await expect(totals).toContainText('▼ 11.0% lower');
  await expect(page.getByRole('region', { name: 'Ranking' })).toContainText(/My copy 1\.530 kg CO₂-eq \(11\.0% lower than A\)/);
  await expect(page.getByRole('region', { name: 'Verdict' })).toContainText('My copy is 11.0% lower in Global Warming than Base case.');
  await expect(page.getByRole('region', { name: 'Change by category' })).toContainText('−11.0%');
  // The walk saw 14.7% on the chip and 14.6% in Ranking for one pair: every percentage on the page agrees now.
  expect(new Set((await percentages(page)).filter((p) => p.startsWith('11.'))).size).toBe(1);

  // The copy run in another region: no percentage anywhere, both totals shown as not comparable.
  await runAs(api, user, s.copyId, 'TRACI 2.1', 'EU');
  await open(page, comparison, { ready: 'Not comparable yet' });
  await expect(page.getByText('Fails: Region differs: US vs EU')).toBeVisible();
  await expect(totals.locator('.cmp-total-num')).toHaveCount(2);
  await expect(totals).toContainText('1.720');
  await expect(totals).toContainText('Not comparable: Region differs: US vs EU.');
  await expect(page.getByRole('region', { name: 'Ranking' })).toContainText('Nothing is ranked: not comparable. Region differs: US vs EU.');
  await expect(page.getByRole('region', { name: 'Verdict' })).toContainText('Region differs: US vs EU');
  await expect(page.getByRole('region', { name: 'Change by category' })).toContainText('No change by category yet: Region differs: US vs EU.');
  expect(await percentages(page)).toEqual([]);
  // What changed names the region, not only flow edits.
  await expect(page.getByRole('list', { name: 'What changed in My copy' })).toContainText(
    'Region (electricity grid): US → EU. The electricity factor changes with the region.',
  );

  // The fix runs the copy (B) again in US, and the check passes.
  const back = page.waitForResponse((r) => r.url().includes(`/api/cases/${s.copyId}/assessments`) && r.request().method() === 'POST', NAV);
  await page.getByRole('button', { name: 'Run My copy again in US (it is in EU)' }).first().click();
  const sent = await back;
  expect(sent.status()).toBe(201);
  expect(sent.request().postDataJSON()).toMatchObject({ region_code: 'US' });
  await expect(page.getByText('Fair to compare', { exact: true })).toBeVisible(NAV);
  await expect(totals).toContainText('▼ 11.0% lower', NAV);

  // A4: the copy run under another method. The fix reruns the copy, not A, and names both methods.
  await runAs(api, user, s.copyId, 'CML 2001', 'US');
  await open(page, comparison, { ready: 'Not comparable yet' });
  await expect(page.getByText('Fails: Method differs: TRACI 2.1 vs CML 2001')).toBeVisible();
  expect(await percentages(page)).toEqual([]);
  await expect(page.getByRole('list', { name: 'What changed in My copy' })).toContainText('LCIA method: TRACI 2.1 → CML 2001.');
  const rerun = page.waitForResponse((r) => /\/api\/cases\/\d+\/assessments/.test(r.url()) && r.request().method() === 'POST', NAV);
  await page.getByRole('button', { name: 'Run My copy again under TRACI 2.1 (it is on CML 2001)' }).first().click();
  const ran = await rerun;
  expect(ran.url()).toContain(`/api/cases/${s.copyId}/assessments`);
  expect(ran.request().postDataJSON()).toMatchObject({ calculation_method: 'TRACI 2.1' });
  await expect(page.getByText('Fair to compare', { exact: true })).toBeVisible(NAV);
  await expect(page.getByText(/^Fails: Method differs/)).toHaveCount(0);
  await expect(totals).toContainText('▼ 11.0% lower', NAV);
});

test('A5 A6: the case header names the run on show; the Write-up gives no change across methods', async ({ api, newUser, signIn }) => {
  const user = await newUser('analyse');
  const s = await sampleWithLighterSteel(api, user);
  const run1 = await runAs(api, user, s.copyId, 'TRACI 2.1', 'US');
  await runAs(api, user, s.copyId, 'CML 2001', 'EU');
  const { page } = await signIn(user);

  // The study is TRACI 2.1 · US; the latest run is CML 2001 · EU, and the header says the run's.
  await open(page, `/project/${s.projectId}/case/${s.copyId}?tab=writeup`, { ready: 'Interpretation' });
  await expect(page.locator('.ws-facts')).toContainText('CML 2001 · EU · Run 2');
  await expect(page.locator('.ws-facts')).not.toContainText('TRACI 2.1');
  // A5: against a TRACI base run, no percentage, and why.
  await expect(page.getByText('No change against the Base case: Method differs: TRACI 2.1 vs CML 2001.')).toBeVisible();
  await expect(page.locator('.ws-pill')).toHaveCount(0);

  // An older run on show: the header names that one.
  await open(page, `/project/${s.projectId}/case/${s.copyId}?tab=results&run=${run1}`, { ready: 'What builds this number' });
  await expect(page.locator('.ws-facts')).toContainText('TRACI 2.1 · US · Run 1', NAV);
});

test('A8: the Results tab and the full results page print the same numbers and the same "How sure"', async ({ api, newUser, signIn }) => {
  const user = await newUser('analyse');
  const ex = await api.as(user.token).post<{ project_id: number; case_id: number }>('/api/example-project');
  const { page } = await signIn(user);

  // The sample: 1.72 (a base case shows two decimals), Acidification 0.001 kg SO2 eq, $1.75.
  await open(page, `/project/${ex.project_id}/case/${ex.case_id}?tab=results`, { ready: 'What builds this number' });
  await expect(page.locator('.ws-answer-num')).toHaveText('1.72');
  await expect(page.getByText('$1.75').first()).toBeVisible();
  await page.getByRole('button', { name: /^Show the other/ }).click();
  const acidTab = page.locator('li').filter({ hasText: /^Acidification/ }).first();
  await expect(acidTab).toContainText(/0\.001 kg SO/);
  const acidTabValue = (await acidTab.locator('.ds-mono').innerText()).trim();
  const sureTab = (await page.getByRole('region', { name: 'How sure' }).locator('p').first().innerText()).trim();
  expect(sureTab).toMatch(/% rests on /);

  await page.getByRole('link', { name: 'Open full page' }).click();
  await expect(page.getByRole('region', { name: 'Total' })).toContainText('1.72', NAV);
  await expect(page.getByRole('region', { name: 'Total' })).not.toContainText('1.720');
  await expect(page.getByRole('region', { name: 'Total' })).toContainText('$1.75');
  const acidFull = page.getByRole('region', { name: 'Category chart' }).locator('li').filter({ hasText: 'Acidification' }).locator('.ds-num');
  await expect(acidFull).toHaveText(acidTabValue);
  await expect(page.getByRole('region', { name: 'How sure' }).locator('p').first()).toHaveText(sureTab);
});

test('C2 G1 G2: a copy has no read-only banner; Limits saves; the report carries the comparison, the run number and the name', async ({ api, newUser, signIn }) => {
  const user = await newUser('analyse');
  const s = await sampleWithLighterSteel(api, user);
  await runAs(api, user, s.copyId, 'TRACI 2.1', 'US');
  const { page } = await signIn(user);

  // C2: the copy can be changed, so the sample's "make your own copy" line is nowhere on it.
  await open(page, `/project/${s.projectId}/case/${s.copyId}`, { ready: 'My copy' });
  await expect(page.getByText(/make your own copy to change it/i)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Instructions' })).toHaveCount(0);

  // G2: Interpretation, Assumptions and Limits, saved with Save and kept.
  await page.getByRole('tab', { name: /^Write-up/ }).click();
  await page.getByRole('textbox', { name: 'Interpretation' }).fill('Steel in 10. Cut blank drives the result.');
  await page.getByRole('textbox', { name: 'Assumptions' }).fill('One bracket per blank.');
  await page.getByRole('textbox', { name: 'Limits' }).fill('Steel is a Global average; the US value would change it.');
  const saved = page.waitForResponse((r) => isCase(r.url(), s.copyId) && r.request().method() === 'PUT', NAV);
  await page.getByRole('button', { name: 'Save the write-up' }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByText('Saved · the write-up')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Limits' })).toHaveValue('Steel is a Global average; the US value would change it.', NAV);

  // G1: the report on the latest run, shown and picked by default.
  const pick = page.getByRole('combobox', { name: 'Run to report' });
  await expect(pick.locator('option:checked')).toHaveText(/^Run 1 · TRACI 2\.1 · US · .*\(latest\)$/);
  const pdf = await exportPdf(page);
  expect(pdf).toContain('Comparison with the base case');
  expect(pdf).toMatch(/Comparable: the same method, region and functional unit/);
  expect(pdf).toContain('1.720');
  expect(pdf).toContain('1.530');
  expect(pdf).toContain('11.0% lower');
  expect(pdf).toMatch(/Run 1, /);
  expect(pdf).toMatch(/Prepared (B|b)y Jordan Journey/);
  expect(pdf).toContain('Steel is a Global average; the US value would change it.');
  expect(pdf).not.toMatch(/make your own copy/i);
  expect(pdf).not.toMatch(/Assessment-\d{6,}/);
  expect(pdf).not.toMatch(/Run #\d+/);
  expect(pdf).not.toContain(user.username);

  // A second run under another method: the report on it refuses the percentage; Run 1 still compares.
  await runAs(api, user, s.copyId, 'CML 2001', 'US');
  await page.reload();
  await expect(pick.locator('option:checked')).toHaveText(/^Run 2 · CML 2001 · US · .*\(latest\)$/, NAV);
  const cml = await exportPdf(page);
  expect(cml).toMatch(/Not comparable: Method differs: TRACI 2\.1 vs CML 2001/);
  expect(cml).not.toMatch(/\d+\.\d% (lower|higher)/);
  // Newest first: the second option is Run 1.
  await pick.selectOption({ index: 1 });
  await expect(pick.locator('option:checked')).toHaveText(/^Run 1 · TRACI 2\.1 · US/);
  const first = await exportPdf(page);
  expect(first).toContain('11.0% lower');
  await expect(page.getByText('Exported · PDF of Run 1')).toBeVisible();
});

test('Unsaved write-up: switching tabs asks Save or Discard, and closing the page asks too', async ({ api, newUser, signIn }) => {
  const user = await newUser('analyse');
  const s = await sampleWithLighterSteel(api, user);
  const { page } = await signIn(user);
  await open(page, `/project/${s.projectId}/case/${s.copyId}?tab=writeup`, { ready: 'Interpretation' });
  const limits = page.getByRole('textbox', { name: 'Limits' });

  // Cancel keeps the text and the tab.
  await limits.fill('First draft');
  await page.getByRole('tab', { name: /^Tree/ }).click();
  const ask = page.getByRole('alertdialog', { name: 'Save the write-up first?' });
  await expect(ask).toBeVisible();
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(limits).toHaveValue('First draft');
  await expect(page).toHaveURL(/tab=writeup/);

  // Discard drops it and goes on.
  await page.getByRole('tab', { name: /^Tree/ }).click();
  await ask.getByRole('button', { name: 'Discard' }).click();
  await expect(page).not.toHaveURL(/tab=writeup/, NAV);
  await page.getByRole('tab', { name: /^Write-up/ }).click();
  await expect(limits).toHaveValue('', NAV);

  // Save keeps it and goes on.
  await limits.fill('Kept on leaving');
  const saved = page.waitForResponse((r) => isCase(r.url(), s.copyId) && r.request().method() === 'PUT', NAV);
  await page.getByRole('tab', { name: /^Results/ }).click();
  await ask.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await saved).request().postDataJSON()).toMatchObject({ limitations: 'Kept on leaving' });
  await expect(page).toHaveURL(/tab=results/, NAV);
  await page.getByRole('tab', { name: /^Write-up/ }).click();
  await expect(limits).toHaveValue('Kept on leaving', NAV);

  // Closing or reloading with unsaved text asks through the browser.
  await limits.fill('Not saved');
  const prompted = new Promise<string>((resolve) => page.once('dialog', (d) => { resolve(d.type()); void d.dismiss(); }));
  await page.close({ runBeforeUnload: true });
  expect(await prompted).toBe('beforeunload');
});

test('Hand-in: in an assignment the next step is the Assignments page; outside one the tick saves only on Save', async ({ api, newUser, signIn }) => {
  const teacher = await newUser('teacher');
  const student = await newUser('student');
  const as = api.as(teacher.token);
  const ex = await as.post<{ project_id: number; case_id: number }>('/api/example-project');
  await as.post(`/api/projects/${ex.project_id}/members`, { email: student.email, role: 'editor' });
  const own = await api.as(student.token).post<{ case_id: number }>(`/api/cases/${ex.case_id}/duplicate`, { case_name: 'Jordan own case' });
  // A template is a case the class may change: the teacher's own copy of the read-only sample.
  const template = await as.post<{ case_id: number }>(`/api/cases/${ex.case_id}/duplicate`, { case_name: 'Class template' });
  const made = await as.post<{ assignment_id: number }>(`/api/projects/${ex.project_id}/assignments`, {
    title: 'Week 1',
    instructions: 'Find the step that drives the footprint.',
    template_case_id: template.case_id,
  });
  const started = await api.as(student.token).post<{ case_id: number }>(`/api/assignments/${made.assignment_id}/start`);
  const { page } = await signIn(student);

  // Outside an assignment: ticking sends nothing until Save.
  await open(page, `/project/${ex.project_id}/case/${own.case_id}?tab=writeup`, { ready: 'Interpretation' });
  const puts: string[] = [];
  page.on('request', (r) => r.method() === 'PUT' && isCase(r.url(), own.case_id) && puts.push(r.postData() ?? ''));
  const tick = page.getByRole('checkbox', { name: /This is my hand-in/ });
  await tick.check();
  await page.waitForTimeout(800);
  expect(puts).toEqual([]);
  await expect(page.getByText('Not saved yet')).toBeVisible();
  const saved = page.waitForResponse((r) => isCase(r.url(), own.case_id) && r.request().method() === 'PUT', NAV);
  await page.getByRole('button', { name: 'Save the hand-in' }).click();
  expect((await saved).request().postDataJSON()).toEqual({ is_final: true });
  await expect(page.getByText('Saved · ticked as your hand-in')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('checkbox', { name: /This is my hand-in/ })).toBeChecked(NAV);

  // In an assignment: the assignment's instructions, no tick, and the next step to hand in.
  await open(page, `/project/${ex.project_id}/case/${started.case_id}?tab=writeup`, { ready: 'Interpretation' });
  await expect(page.getByRole('region', { name: 'Instructions' })).toContainText('Find the step that drives the footprint.', NAV);
  await expect(page.getByText(/make your own copy to change it/i)).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /This is my hand-in/ })).toHaveCount(0);
  const handIn = page.getByRole('link', { name: 'Hand in on the Assignments page' });
  await expect(handIn).toHaveAttribute('href', `/project/${ex.project_id}/assignments`);
});
