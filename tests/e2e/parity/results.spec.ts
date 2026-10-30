/**
 * Kept and moved rows of Results and Write-up, and classic Analytics moved onto
 * the full results page. Export (R13) and the what-if (R15) are exercised by
 * the journeys.
 */
import { expect } from '@playwright/test';
import { openCase, workedExample } from '../support/editor';
import { test } from '../support/fixtures';
import { row } from '../support/parity';

test('R01 R03 R04 R05 R06 R07 R08 R09 R10 R11 P48 G129 the full results page of a case run twice', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-full-results');
  const as = api.as(user.token);
  const { projectId, caseId } = await workedExample(api, user);
  // A flow with no amount: the run freezes a warning about it (R11).
  const comps = (await as.get<{ components: Array<{ component_id: number; component_name: string }> }>(`/api/cases/${caseId}/components`)).components;
  const cut = comps.find((c) => c.component_name === '10. Cut blank')!;
  const subs = (await as.get<{ substances: Array<{ substance_id: number; substance_name: string }> }>('/api/substances')).substances;
  const water = await as.post<{ flow: { flow_id: number } }>(`/api/components/${cut.component_id}/flows`, {
    substance_id: subs.find((x) => x.substance_name === 'Electricity')!.substance_id,
    flow_type: 'input',
    unit: 'kWh',
  });
  await as.post(`/api/cases/${caseId}/assessments`, { calculation_method: 'TRACI 2.1', region_code: 'US' });
  // R03: a CML run in between must not be read as the previous run.
  await as.post(`/api/cases/${caseId}/assessments`, { calculation_method: 'CML 2001', region_code: 'Global' });
  await as.put(`/api/flows/${water.flow.flow_id}`, { quantity: 0 });
  await as.post(`/api/cases/${caseId}/assessments`, { calculation_method: 'TRACI 2.1', region_code: 'US' });
  const { page } = await signIn(user);
  await page.goto(`/project/${projectId}/case/${caseId}/results`);
  const main = page.getByRole('main');

  await row(main.getByRole('heading', { name: 'My bracket' }), 'R01', 'Full-page results, printable');
  await row(main.getByText('Run 3 of this case · TRACI 2.1 · US'), 'R01', 'the run read in its own case (2.8)');
  await row(page.getByRole('region', { name: 'Total' }).getByText(/from Run 1 \(TRACI 2\.1, US\)/), 'R03', 'change against the previous run on the same method and region, not Run 2 (CML)');
  await row(page.getByRole('region', { name: 'At a glance' }).getByText(/^Last run /), 'R04', 'KPI row: categories, steps, last run');
  await row(page.getByRole('region', { name: 'Top contributors' }).getByRole('link').first(), 'R05', 'Top contributors, each opens its step');
  await row(page.getByRole('region', { name: 'ISO summary' }).getByText('Functional unit'), 'R07', 'ISO goal and scope frozen with the run');
  await row(page.getByRole('region', { name: 'ISO summary' }).getByRole('listitem').first(), 'R07', 'Data-quality statement, its lines');
  await row(page.getByRole('region', { name: /^Life-cycle stages/ }).getByText(/Production/), 'R08', 'Stage panel');
  const flows = page.getByRole('region', { name: 'Flows' });
  await row(flows.getByRole('columnheader', { name: 'Factor' }), 'R09', 'Flow table: amount x factor = impact');
  await row(flows.getByRole('radiogroup', { name: 'Direction' }), 'R09', 'Flow table filter');
  await row(flows.getByRole('row').nth(1).getByRole('link'), 'R09', 'Flow table jumps to its step');
  await row(page.getByRole('region', { name: 'Flows' }).getByText('Global fallback').first(), 'R09', 'Global-fallback flag');
  await row(page.getByRole('region', { name: 'Left out' }).getByText(/No value in /), 'R17', 'the full page names the categories left out');

  // R06: the whole page follows the chosen category.
  const categories = page.getByRole('radiogroup', { name: 'Category' });
  await row(categories, 'R06', 'Switch the whole page to another category');
  const other = categories.getByRole('radio', { checked: false }).first();
  const otherName = (await other.textContent())!.trim();
  await other.click();
  await expect.soft(flows.getByText(`Flows in ${otherName}:`), 'R06 the flow table follows the category').toBeVisible();
  await expect.soft(page.getByRole('region', { name: 'Run history' }).getByRole('columnheader', { name: otherName }), 'R06 run history follows the category').toBeVisible();

  // G129: the classic Analytics views.
  const chart = page.getByRole('radiogroup', { name: 'Chart' });
  await chart.getByRole('radio', { name: 'Radar' }).click();
  await row(page.getByRole('img', { name: /^Category radar/ }), 'G129', 'Radar view');
  await chart.getByRole('radio', { name: 'Absolute' }).click();
  const bar = page.getByRole('region', { name: 'Category chart' }).locator('li').nth(1).locator('span[aria-hidden]');
  const absWidth = await bar.evaluate((el) => el.getBoundingClientRect().width);
  await chart.getByRole('radio', { name: 'Log scale' }).click();
  await row(chart.getByRole('radio', { name: 'Log scale', checked: true }), 'G129', 'Log-scale view');
  expect.soft(await bar.evaluate((el) => el.getBoundingClientRect().width), 'G129 the log view redraws the bars').not.toBe(absWidth);

  // R10: every run of the case, and an older one opens.
  const history = page.getByRole('region', { name: 'Run history' });
  await expect.soft(history.getByRole('row'), 'R10 run history lists every run').toHaveCount(4);
  await row(history.getByRole('cell', { name: 'CML 2001' }), 'R10', "Run history shows each run's method");
  await history.getByRole('button', { name: 'Run 1' }).click();
  await row(main.getByText('Run 1 of this case · TRACI 2.1 · US'), 'R10', 'Run history opens an older run');
  // R11: Run 1 froze its warning about the flow with no amount; fixing the flow later does not change Run 1.
  await expect.soft(page.getByRole('region', { name: 'Data quality warnings' }).getByRole('listitem').first(), 'R11 the warning frozen with Run 1').toBeVisible();

  // P48: printing shows the page, not the shell.
  await page.emulateMedia({ media: 'print' });
  await expect.soft(page.locator('.ws-full-results'), 'P48 the page prints').toBeVisible();
  await expect.soft(page.getByRole('navigation').first(), 'P48 the shell does not print').toBeHidden();
});

test('P50 P52 P53 P55 P56 a copy against its base case: one cost, the chart, and step by step', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-full-results-base');
  const as = api.as(user.token);
  const { projectId, caseId } = await workedExample(api, user);
  await as.post(`/api/cases/${caseId}/assessments`, {});
  // A cost changed after the run does not change what the run says.
  const comps = (await as.get<{ components: Array<{ component_id: number; component_name: string }> }>(`/api/cases/${caseId}/components`)).components;
  await as.put(`/api/components/${comps.find((c) => c.component_name === '10. Cut blank')!.component_id}`, { material_cost: 99 });
  const { page } = await signIn(user);
  await page.goto(`/project/${projectId}/case/${caseId}/results`);

  const card = page.getByRole('region', { name: 'This case' });
  await row(card.getByText(/^the same \(base case Run 1, TRACI 2\.1 · US\)$/), 'P50', 'Case card: change against the base case');
  // One cost on the page: the headline and the card both read the run as frozen.
  const headline = (await page.getByRole('region', { name: 'Total' }).getByText(/^Cost /).textContent())!.replace('Cost ', '');
  expect.soft(headline, "P50 the run's own cost, frozen: the $99 entered after it is not in it").toBe('$1.75');
  await expect.soft(card.getByText(headline, { exact: true }), 'P50 the card and the headline show one cost').toBeVisible();

  await row(page.getByRole('radiogroup', { name: 'Chart' }), 'P52', 'Absolute, Radar and Log');
  const cost = page.getByRole('region', { name: 'Cost by kind' });
  await row(cost.getByRole('cell', { name: 'Material' }), 'P53', 'Cost by kind');
  await row(cost.getByText(/^Cost per unit impact: \$[\d,.]+ per kg CO2 eq$/), 'P53', 'Cost per unit impact, with its unit');
  await row(page.getByRole('img', { name: /^This case: / }), 'P55', 'Stacked step bar, this case');
  await row(page.getByRole('img', { name: /^Base case: / }), 'P55', 'Stacked step bar, base case');

  // P56: a copy's steps have new ids, and still line up with the base case.
  const diff = page.getByRole('region', { name: 'Step diff' });
  await row(diff.getByRole('cell', { name: 'same' }).first(), 'P56', 'Step diff against the base case');
  await expect.soft(diff.getByText('not in the base case'), 'P56 every step of the copy is found in the base case').toHaveCount(0);
});

test('R02 choose method and region for a run', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-run-dialog');
  const { projectId, caseId } = await workedExample(api, user);
  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await page.getByRole('button', { name: 'Run Assessment' }).click();
  await row(page.getByRole('dialog', { name: 'Run assessment' }), 'R02', 'Choose method and region for a run');
});

test('P05 P45 P46 P47 Analytics: a case link opens its results, and a solo owner sees their own cases', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-analytics');
  const { projectId, caseId } = await workedExample(api, user);
  await api.as(user.token).post(`/api/cases/${caseId}/assessments`, {});
  const { page } = await signIn(user);
  await page.goto(`/project/${projectId}/analytics?caseId=${caseId}`);
  await expect.soft(page, 'P05 P45 the old Analytics link opens that case on the full results page').toHaveURL(new RegExp(`/project/${projectId}/case/${caseId}/results$`));
  await page.goto(`/project/${projectId}/analytics`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 90_000 });
  await expect.soft(page.getByText(/^Loading/), 'P46 the page has loaded').toHaveCount(0, { timeout: 90_000 });
  await expect.soft(page.getByText(/No .* cases yet/), 'P46 a solo owner is not shown an empty class').toHaveCount(0);
  await row(page.getByRole('heading', { level: 1 }), 'P47', 'Header: project name and the count of what it shows');
});

test('G142 Magic Insights opens on the category picked on Results', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-insights-category');
  const { projectId, caseId } = await workedExample(api, user);
  await api.as(user.token).post(`/api/cases/${caseId}/assessments`, {});
  const { page } = await signIn(user);
  await page.goto(`/project/${projectId}/case/${caseId}/results`);
  const other = page.getByRole('radiogroup', { name: 'Category' }).getByRole('radio', { checked: false }).first();
  const otherName = (await other.textContent())!.trim();
  await other.click();
  await page.getByRole('button', { name: 'Magic Insights' }).click();
  const insights = page.getByRole('dialog', { name: 'Magic Insights' });
  await row(insights, 'G142', 'Opens on the category picked on Results');
  await expect.soft(insights.getByRole('combobox'), 'G142 the category picked on Results is the one shown').toHaveValue(otherName);
});

test('R17 R18 R19 R20 R21 R23 the Results panel on a six-digit case, then an edit after its run', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-results-findings');
  const as = api.as(user.token);
  const { projectId, caseId, baseCaseId } = await workedExample(api, user);
  // The cure oven's electricity in the copy, raised so totals run to six digits (finding 3.3).
  const inv = await as.get<{ rows: Array<{ flow_id: number; substance: string; amount: number }> }>(`/api/cases/${caseId}/inventory`);
  const oven = inv.rows.find((r) => r.substance === 'Electricity' && r.amount === 0.4)!;
  await as.put(`/api/flows/${oven.flow_id}`, { quantity: 500000 });
  await as.post(`/api/cases/${caseId}/assessments`, {});

  const { page } = await signIn(user);
  await page.goto(`/project/${projectId}/case/${caseId}?tab=results`);
  const panel = page.getByRole('complementary', { name: /^Results, / });
  await row(panel.getByText('Run 1', { exact: true }).first(), 'R20', 'A run is named by its place in its case');
  await row(panel.getByRole('note').getByText(/^Not counted: /), 'R17', 'Categories left out are named, not zero');

  // R21: no value runs into its share, and the unit under the answer is not cut off.
  const rows = panel.locator('li').filter({ has: page.locator('.ws-bar') });
  expect.soft(await rows.count(), 'R21 What builds this number has rows').toBeGreaterThan(0);
  for (const li of await rows.all()) {
    const [value, pct] = await li.locator('.ds-mono').all();
    // Text wider than its column spills into the next one: it must fit its own box.
    for (const cell of [value, pct]) {
      expect.soft(await cell.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `R21 "${await cell.textContent()}" fits its column`).toBe(true);
    }
    const a = (await value.boundingBox())!;
    const b = (await pct.boundingBox())!;
    expect.soft(a.x + a.width, `R21 ${await value.textContent()} stays clear of ${await pct.textContent()}`).toBeLessThanOrEqual(b.x + 0.5);
  }
  for (const unit of await panel.locator('.ws-answer > .ds-mono').all()) {
    expect.soft(await unit.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `R21 "${await unit.textContent()}" is whole`).toBe(true);
  }

  // R23: nothing is said right after the run; an edit put back is still said, with Compare's rule (3.11).
  await expect.soft(panel.getByText('Edited after this run.'), 'R23 nothing to say right after the run').toHaveCount(0);
  await as.put(`/api/flows/${oven.flow_id}`, { quantity: 400000 });
  await as.put(`/api/flows/${oven.flow_id}`, { quantity: 500000 });
  await page.reload();
  await row(panel.getByText('Edited after this run.'), 'R23', 'Results says the case changed after its run, even when the value was put back');

  // R18: each Source data value carries its unit.
  await page.goto(`/project/${projectId}/case/${caseId}/results`);
  await page.getByRole('button', { name: 'Magic Insights' }).click();
  const insights = page.getByRole('dialog', { name: 'Magic Insights' });
  await row(insights.getByText(/^Source data: top contributors/i), 'R18', 'Source data is labelled');
  await expect.soft(insights.getByText(/ kg CO2 eq$/).first(), 'R18 each Source data value carries its unit').toBeVisible();
  await page.keyboard.press('Escape');

  // R19: the base case has nothing to compare itself with.
  await page.goto(`/project/${projectId}/case/${baseCaseId}/results`);
  await page.getByRole('button', { name: 'Magic Insights' }).click();
  await row(page.getByRole('dialog', { name: 'Magic Insights' }), 'R19', 'Magic Insights opens on the base case');
  await expect.soft(page.getByRole('dialog', { name: 'Magic Insights' }).getByRole('button', { name: 'Compare to base' }), 'R19 no Compare to base on the base case').toHaveCount(0);
});

test('R12 R14 R16 an older run, the write-up, and Magic Insights', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-results');
  const as = api.as(user.token);
  const { projectId, caseId } = await workedExample(api, user);
  const first = await as.post<{ run_id: number }>(`/api/cases/${caseId}/assessments`, { run_name: 'First' });
  await as.post(`/api/cases/${caseId}/assessments`, { run_name: 'Second' });

  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await page.goto(`/project/${projectId}/case/${caseId}?tab=results&run=${first.run_id}`);
  await row(page.getByText(/is an older run/), 'R12', 'Older-run banner');

  await page.getByRole('tab', { name: /^Write-up/ }).click();
  await row(page.getByRole('complementary', { name: /^Write-up,/ }), 'R14', 'Write-up');

  await page.getByRole('tab', { name: /^Results/ }).click();
  await row(page.getByRole('button', { name: 'Magic Insights' }), 'R16', 'Magic Insights on the selected category');
});
