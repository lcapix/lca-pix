/**
 * The case editor walked as a student does (lane 1, v1-walk-defects
 * 2026-11-01): every check is an outcome, the number on screen or what the
 * API stored, never only that a button exists. Her rules: Enter never saves;
 * Save only, which answers "Saved" in view; leaving with unsaved changes asks.
 *
 *   A1  a unit change converts the amount (0.80 kg → 800 g), or is refused
 *   A2  an own factor shows its basis and follows the unit; "Hand-entered"
 *   B1  amount, unit, direction, Step under, stage and cost lookups wait for Save
 *   B2  Enter in Add a step and in Rename adds or saves nothing
 *   B3  another step, another tab, browser back and closing the page ask first
 *   C4  a read-only case shows plain values and says why
 *   E1  the Inventory edits every part of a flow
 *   E2  your own factor on a flow with no factor, kept on the frozen run
 *   E3  a cost on a step with no flow says it adds no impact
 *   E4  costs sit on the rows with the math, no sideways scroll
 *   E5  the flows' cost never replaces a stored cost in one click
 *   E6  "Step under" opens on the current parent
 *   E7  flows first, details collapsed, one switch, steps clickable, add list ranked
 */
import type { Page } from '@playwright/test';
import type { Api, ApiUser } from '../support/api';
import { openCase, workedExample } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';

type Component = { component_id: number; component_name: string; parent_component_id: number | null; description?: string | null; life_cycle_stage?: string | null };
type Flow = { flow_id: number; substance_id: number; substance_name: string; quantity: number | string | null; unit: string; flow_type: string; component_id: number };
type InvRow = { flow_id: number; component_id: number; substance: string; amount: number | null; unit: string; direction: string; climate: null | { factor: number; impact: number; tag: string; source: string | null; per?: string } };

const NAV = { timeout: 60_000 };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const step = (page: Page, name: string) => page.getByRole('treeitem', { name: new RegExp(`^${esc(name)}, `) });
const panel = (page: Page, name: string) => page.getByRole('complementary', { name: `Step: ${name}` });

async function components(api: Api, user: ApiUser, caseId: number): Promise<Component[]> {
  return (await api.as(user.token).get<{ components: Component[] }>(`/api/cases/${caseId}/components`)).components;
}
async function idOf(api: Api, user: ApiUser, caseId: number, name: string): Promise<number> {
  return (await components(api, user, caseId)).find((c) => c.component_name === name)!.component_id;
}
async function flowsOf(api: Api, user: ApiUser, componentId: number): Promise<Flow[]> {
  return (await api.as(user.token).get<{ flows: Flow[] }>(`/api/components/${componentId}/flows`)).flows;
}
async function inventory(api: Api, user: ApiUser, caseId: number): Promise<InvRow[]> {
  return (await api.as(user.token).get<{ rows: InvRow[] }>(`/api/cases/${caseId}/inventory`)).rows;
}
async function costOf(api: Api, user: ApiUser, componentId: number, kind: string): Promise<number | null> {
  const d = await api.as(user.token).get<{ costs: Array<{ kind: string; amount: number | null }> }>(`/api/components/${componentId}/costs`);
  return d.costs.find((c) => c.kind === kind)?.amount ?? null;
}

/** Every write the page sends to the API from now on. */
function writes(page: Page): string[] {
  const seen: string[] = [];
  page.on('request', (r) => {
    if (['PUT', 'POST', 'DELETE'].includes(r.method()) && r.url().includes('/api/')) seen.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  return seen;
}

/** A line is in view when its box sits inside the window (B4: the Saved line is not below the fold). */
async function inView(page: Page, text: string | RegExp) {
  const el = page.getByText(text).first();
  await expect(el).toBeVisible();
  const box = await el.boundingBox();
  const vp = page.viewportSize()!;
  expect(box && box.y >= 0 && box.y + box.height <= vp.height, `"${text}" is in view`).toBe(true);
}

test.describe('editor hardening: the step panel', () => {
  test('A1 B1 B4 a unit change converts the amount, waits for Save, and keeps the impact; Enter, Tab and leaving the box save nothing', async ({ api, newUser, signIn }) => {
    const user = await newUser('unit');
    const { projectId, caseId } = await workedExample(api, user);
    const cut = await idOf(api, user, caseId, '10. Cut blank');
    const before = (await inventory(api, user, caseId)).find((r) => r.component_id === cut && r.substance === 'Steel')!;
    expect(before).toMatchObject({ amount: 0.8, unit: 'kg' });

    const { page } = await signIn(user);
    const sent = writes(page);
    await openCase(page, projectId, caseId);
    await step(page, '10. Cut blank').click();
    const p = panel(page, '10. Cut blank');
    const box = p.getByRole('textbox', { name: 'Steel, amount in kg', exact: true });
    await expect(box).toHaveValue('0.80');

    // Typing, Enter, Tab and leaving the box: nothing is sent.
    await box.fill('0.75');
    await box.press('Enter');
    await box.press('Tab');
    await p.getByText('Not saved yet').first().waitFor();
    expect(sent.filter((s) => s.startsWith('PUT /api/flows'))).toEqual([]);
    await p.getByRole('button', { name: 'Discard the changes to Steel on 10. Cut blank' }).click();
    await expect(box).toHaveValue('0.80');

    // A1: kg → g converts what the box holds: 0.80 kg is 800 g. Still nothing sent.
    await p.getByRole('combobox', { name: 'Unit for Steel' }).selectOption('g');
    const inG = p.getByRole('textbox', { name: 'Steel, amount in g', exact: true });
    await expect(inG).toHaveValue('800');
    await expect(p.getByText('Converted: 0.8 kg = 800 g. Save to keep it.')).toBeVisible();
    expect(sent.filter((s) => s.startsWith('PUT /api/flows'))).toEqual([]);

    const put = page.waitForResponse((r) => /^\/api\/flows\/\d+$/.test(new URL(r.url()).pathname) && r.request().method() === 'PUT');
    await p.getByRole('button', { name: 'Save Steel on 10. Cut blank' }).click();
    const res = await put;
    expect(res.status()).toBe(200);
    expect(res.request().postDataJSON()).toMatchObject({ quantity: 800, unit: 'g' });
    await inView(page, /Saved · Steel 800 g \(was 0\.80 kg\) on 10\. Cut blank/);

    // Stored as the same mass, and the impact is the same number.
    const steel = (await flowsOf(api, user, cut)).find((f) => f.substance_name === 'Steel')!;
    expect([Number(steel.quantity), steel.unit]).toEqual([800, 'g']);
    const after = (await inventory(api, user, caseId)).find((r) => r.flow_id === before.flow_id)!;
    expect(after.climate!.impact).toBeCloseTo(before.climate!.impact, 9);
    // The row says what it multiplied: 800 g, converted to the factor's kg.
    await expect(p.locator('.ws-sum').first()).toContainText('800 g (1 g = 0.001 kg) ×');
  });

  test('A1 only units that convert are offered; a unit that cannot convert is refused with the reason and changes nothing', async ({ api, newUser, signIn }) => {
    // The sample no longer carries a flow in a unit its factors cannot take
    // (C6), and new flows are refused one, so the refusal is met through the
    // API (an older or imported row); the reason's wording is pinned in
    // tests/lib/workspace/flow-edit.test.ts.
    const user = await newUser('unit-refuse');
    const { projectId, caseId } = await workedExample(api, user);
    const cut = await idOf(api, user, caseId, '10. Cut blank');
    const steel = (await flowsOf(api, user, cut)).find((f) => f.substance_name === 'Steel')!;
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    await step(page, '10. Cut blank').click();
    const p = panel(page, '10. Cut blank');
    const offered = await p.getByRole('combobox', { name: 'Unit for Steel' }).locator('option').allInnerTexts();
    expect(offered).toContain('kg');
    expect(offered).toContain('g');
    for (const wrong of ['kWh', 'MJ', 'tkm', 'm3']) expect(offered, `${wrong} is not offered for Steel`).not.toContain(wrong);

    const refused = await api.as(user.token).put(`/api/flows/${steel.flow_id}`, { unit: 'kWh' }).then(
      () => null,
      (e) => e as { status: number; body: string },
    );
    expect(refused?.status).toBe(400);
    expect(refused?.body).toMatch(/cannot be converted to 'kg'/);
    const after = (await flowsOf(api, user, cut)).find((f) => f.flow_id === steel.flow_id)!;
    expect([Number(after.quantity), after.unit]).toEqual([Number(steel.quantity), steel.unit]);
  });

  test('B1 direction waits for Save and the Saved line says what was stored; E6 Step under opens on the parent; stage waits for Save', async ({ api, newUser, signIn }) => {
    const user = await newUser('direction');
    const { projectId, caseId } = await workedExample(api, user);
    const cut = await idOf(api, user, caseId, '10. Cut blank');
    const { page } = await signIn(user);
    const sent = writes(page);
    await openCase(page, projectId, caseId);
    await step(page, '10. Cut blank').click();
    const p = panel(page, '10. Cut blank');

    await p.getByRole('combobox', { name: 'Direction for Steel' }).selectOption('output');
    expect(sent.filter((s) => s.startsWith('PUT /api/flows'))).toEqual([]);
    await p.getByRole('button', { name: 'Save Steel on 10. Cut blank' }).click();
    await expect(p.getByText(/Saved · Steel 0\.80 kg, an output \(Out\) on 10\. Cut blank/)).toBeVisible();
    expect((await flowsOf(api, user, cut)).find((f) => f.substance_name === 'Steel')!.flow_type).toBe('output');
    // Back to In: the line says In, not "is out" (B4).
    await p.getByRole('combobox', { name: 'Direction for Steel' }).selectOption('input');
    await p.getByRole('button', { name: 'Save Steel on 10. Cut blank' }).click();
    await expect(p.getByText(/Saved · Steel 0\.80 kg, an input \(In\) on 10\. Cut blank/)).toBeVisible();
    expect((await flowsOf(api, user, cut)).find((f) => f.substance_name === 'Steel')!.flow_type).toBe('input');

    // E7: the flows come first; Step details is closed below them.
    const summary = p.locator('summary', { hasText: 'Step details' });
    const flowBox = await p.locator('.ws-flow').first().boundingBox();
    const sumBox = await summary.boundingBox();
    expect(flowBox!.y).toBeLessThan(sumBox!.y);
    await expect(p.getByLabel('Step name', { exact: true })).toBeHidden();
    await summary.click();

    // E6: "Step under", on the current parent; another one waits for Save.
    const under = p.getByRole('combobox', { name: 'Step under' });
    await expect(under.locator('option:checked')).toHaveText('Cutting (now)');
    const welding = await idOf(api, user, caseId, 'Welding');
    await under.selectOption({ label: 'Welding' });
    expect(sent.filter((s) => s === `PUT /api/components/${cut}`)).toEqual([]);
    await p.getByRole('button', { name: 'Save the step it sits under' }).click();
    await expect(page.getByText('Saved · 10. Cut blank is now under Welding')).toBeVisible();
    expect((await components(api, user, caseId)).find((c) => c.component_id === cut)!.parent_component_id).toBe(welding);

    // The stage too (the sample puts 10. Cut blank in Production since migrate-046,
    // its steel counting in Materials through the flow; move the step to Use).
    expect((await components(api, user, caseId)).find((c) => c.component_id === cut)!.life_cycle_stage).toBe('production');
    await p.getByRole('combobox', { name: 'Life-cycle stage' }).selectOption('use');
    expect(sent.filter((s) => s === `PUT /api/components/${cut}`)).toHaveLength(1); // only the Step under save
    expect((await components(api, user, caseId)).find((c) => c.component_id === cut)!.life_cycle_stage).toBe('production');
    await p.getByRole('button', { name: 'Save the life-cycle stage' }).click();
    await expect(page.getByText('Saved · stage Use')).toBeVisible();
    expect((await components(api, user, caseId)).find((c) => c.component_id === cut)!.life_cycle_stage).toBe('use');
  });

  test('E7 one Impact/Cost switch; a step under the panel scrolls clear and can be clicked; the add list is ranked and reads 8.6', async ({ api, newUser, signIn }) => {
    const user = await newUser('panel');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    await page.getByRole('radio', { name: 'Cost', exact: true }).click();
    await step(page, '20. Weld tab').click();
    await expect(panel(page, '20. Weld tab').getByText('4 of 6 set')).toBeVisible(NAV);
    await expect(page.getByRole('radio', { name: 'Cost', exact: true })).toHaveCount(1);
    await expect(page.getByRole('radiogroup', { name: 'Panel shows' })).toHaveCount(0);
    await page.getByRole('radio', { name: 'Impact', exact: true }).click();

    // The tree can scroll clear of the panel: scrolled to its end, the last step sits left of the panel.
    const vp = page.getByRole('tree');
    await vp.evaluate((el) => (el.scrollLeft = el.scrollWidth));
    const steps = page.getByRole('treeitem');
    let rightmost = { x: -1, name: '' };
    for (const s of await steps.all()) {
      const b = await s.boundingBox();
      if (b && b.x + b.width > rightmost.x) rightmost = { x: b.x + b.width, name: (await s.getAttribute('aria-label')) ?? '' };
    }
    const panelBox = await page.locator('.ws-panel').boundingBox();
    expect(rightmost.x).toBeLessThan(panelBox!.x);
    const name = rightmost.name.split(',')[0];
    await page.getByRole('treeitem', { name: rightmost.name }).click();
    await expect(page.getByRole('treeitem', { name: rightmost.name })).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page, name)).toBeVisible();

    // The add list: nothing typed shows common materials, not ".alpha.-Cypermethrin"; factors read short.
    await step(page, '20. Weld tab').click();
    const weld = panel(page, '20. Weld tab');
    await weld.getByRole('button', { name: '+ Add a flow to this step' }).click();
    const options = weld.getByRole('group', { name: 'Matching substances' }).locator('.af-option-name');
    await expect(options.first()).toBeVisible(NAV);
    const first = (await options.allTextContents()).map((t) => t.trim());
    expect(first.some((t) => /^\.|^\d/.test(t))).toBe(false);
    expect(first.some((t) => /^Steel/.test(t))).toBe(true);
    await weld.getByPlaceholder('Search substances…').fill('steel');
    await expect(weld.getByRole('group', { name: 'Matching substances' }).locator('.af-option-name').first()).toHaveText(/^Steel(?!\s)/);
    const meta = await weld.locator('.af-option-meta').allTextContents();
    expect(meta.some((m) => /\d\.\d{6,}/.test(m))).toBe(false);
  });

  test('B3 another step, another tab and browser back ask first; Discard keeps nothing, Save keeps it; closing the page warns', async ({ api, newUser, signIn }) => {
    const user = await newUser('unsaved');
    const { projectId, caseId } = await workedExample(api, user);
    const cut = await idOf(api, user, caseId, '10. Cut blank');
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    await step(page, '10. Cut blank').click();
    const p = panel(page, '10. Cut blank');
    const bar = page.getByRole('alertdialog', { name: 'You have unsaved changes' });

    // A description typed, then another step: asked; Discard opens that step and stores nothing.
    await p.locator('summary', { hasText: 'Step details' }).click();
    await p.getByLabel('Step description').fill('Sheared from 1.5 mm coil');
    await step(page, '20. Weld tab').click();
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('the description of 10. Cut blank');
    await expect(p).toBeVisible();
    await bar.getByRole('button', { name: 'Discard' }).click();
    await expect(panel(page, '20. Weld tab')).toBeVisible();
    expect((await components(api, user, caseId)).find((c) => c.component_id === cut)!.description ?? '').not.toContain('1.5 mm coil');

    // An amount typed, then the Inventory tab: asked; Save stores it, then the tab opens.
    await step(page, '10. Cut blank').click();
    await p.getByRole('textbox', { name: 'Steel, amount in kg', exact: true }).fill('0.7');
    await page.getByRole('tab', { name: /^Inventory/ }).click();
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('tab', { name: /^Inventory/ })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(async () => Number((await flowsOf(api, user, cut)).find((f) => f.substance_name === 'Steel')!.quantity)).toBe(0.7);

    // Browser back with an unsaved amount: asked, still on the case; Discard goes back to Home.
    await open(page, '/home');
    await open(page, `/project/${projectId}/case/${caseId}`);
    await expect(page.getByRole('tree')).toBeVisible();
    await step(page, '10. Cut blank').click();
    await p.getByRole('textbox', { name: 'Steel, amount in kg', exact: true }).fill('0.65');
    const url = page.url();
    await page.goBack();
    await expect(bar).toBeVisible();
    expect(page.url()).toBe(url);
    await bar.getByRole('button', { name: 'Discard' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/home');
    expect(Number((await flowsOf(api, user, cut)).find((f) => f.substance_name === 'Steel')!.quantity)).toBe(0.7);

    // Closing the page with an unsaved amount: the browser asks (beforeunload).
    await open(page, `/project/${projectId}/case/${caseId}`);
    await step(page, '10. Cut blank').click();
    await p.getByRole('textbox', { name: 'Steel, amount in kg', exact: true }).fill('0.6');
    const asked = new Promise<string>((resolve) => page.once('dialog', (d) => (resolve(d.type()), void d.dismiss())));
    await page.close({ runBeforeUnload: true });
    expect(await asked).toBe('beforeunload');
  });

  test('B2 Enter in Add a step adds nothing and Enter in Rename saves nothing', async ({ api, newUser, signIn }) => {
    const user = await newUser('enter');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    const sent = writes(page);
    await openCase(page, projectId, caseId);
    await page.getByRole('button', { name: 'Add step', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Add a step' });
    await form.getByLabel('Name').fill('Inspection line');
    await form.getByLabel('Name').press('Enter');
    await expect(form).toBeVisible();
    expect(sent.filter((s) => s.startsWith('POST /api/cases'))).toEqual([]);
    await form.getByRole('button', { name: 'Add the step' }).click();
    await expect(step(page, 'Inspection line')).toBeVisible();

    await page.getByRole('button', { name: 'Hide panel' }).click();
    await step(page, 'Cutting').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const rename = page.getByRole('dialog', { name: 'Rename step' });
    await rename.getByLabel('Name').fill('Tube cutting');
    await rename.getByLabel('Name').press('Enter');
    await expect(rename).toBeVisible();
    expect((await components(api, user, caseId)).some((c) => c.component_name === 'Tube cutting')).toBe(false);
    await rename.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(step(page, 'Tube cutting')).toBeVisible();
  });
});

test.describe('editor hardening: own factors', () => {
  test('A2 E2 your own factor shows its basis, follows a unit change, reads Hand-entered everywhere and stays on the frozen run', async ({ api, newUser, signIn }) => {
    test.setTimeout(240_000);
    const user = await newUser('own-factor');
    const { projectId, caseId } = await workedExample(api, user);
    const cut = await idOf(api, user, caseId, '10. Cut blank');
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    await step(page, '10. Cut blank').click();
    const p = panel(page, '10. Cut blank');

    // Steel has a regional library factor: your own number is offered on it too (E2).
    await p.locator('.ws-flow').filter({ hasText: 'Steel' }).first().getByRole('button', { name: 'Use my own factor' }).click();
    const form = p.getByRole('group', { name: 'Your own factor for Steel' });
    await expect(form.getByText('Your factor, in kg CO₂-eq per kg')).toBeVisible();
    await form.getByLabel(/Your factor, in/).fill('2.5');
    await form.getByLabel('Where it comes from').fill('Mill EPD 2025');
    await form.getByRole('button', { name: 'Save your own factor for Steel' }).click();
    await expect(p.getByText('Saved · your own factor for Steel: 2.5 kg CO₂-eq per kg (Hand-entered: Mill EPD 2025)')).toBeVisible();
    const steel = p.locator('.ws-flow').filter({ hasText: 'Hand-entered: Mill EPD 2025' });
    await expect(steel.getByText('Hand-entered', { exact: true })).toBeVisible();
    await expect(steel.locator('.ws-sum')).toHaveText('0.80 kg × 2.5 kg CO₂-eq per kg = 2.00 kg CO₂-eq');

    // A2: kg → g. The factor is restated per g and the impact stays 2.000.
    await p.getByRole('combobox', { name: 'Unit for Steel' }).selectOption('g');
    await p.getByRole('button', { name: 'Save Steel on 10. Cut blank' }).click();
    await expect(p.getByText(/Saved · Steel 800 g/)).toBeVisible();
    const flowId = (await flowsOf(api, user, cut)).find((f) => f.substance_name === 'Steel')!.flow_id;
    const own = (await api.as(user.token).get<{ factors: Array<{ factor_value: number; per_unit: string; source: string }> }>(`/api/flows/${flowId}/factor`)).factors[0];
    expect([Number(own.factor_value), own.per_unit, own.source]).toEqual([0.0025, 'g', 'Mill EPD 2025']);
    await expect(p.locator('.ws-flow').filter({ hasText: 'Hand-entered: Mill EPD 2025' }).locator('.ws-sum')).toHaveText('800 g × 0.0025 kg CO₂-eq per g = 2.00 kg CO₂-eq');

    // The Inventory says Hand-entered with the source.
    await page.getByRole('tab', { name: /^Inventory/ }).click();
    const row = page.getByRole('row').filter({ has: page.getByRole('textbox', { name: 'Steel, amount in g', exact: true }) });
    await expect(row.getByText('Hand-entered', { exact: true })).toBeVisible();
    await expect(row.getByText('Hand-entered: Mill EPD 2025')).toBeVisible();

    // Run; the full results row says "Hand-entered: Mill EPD 2025", never "source not on record".
    const ran = page.waitForResponse((r) => /^\/api\/cases\/\d+\/assessments$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Run the case', exact: true }).click();
    await page.getByRole('dialog', { name: 'Run the case' }).getByRole('button', { name: 'Run', exact: true }).click();
    const run = await ran;
    expect(run.status()).toBe(201);
    const runId = (await run.json()).run_id;
    const results = `/project/${projectId}/case/${caseId}/results?run=${runId}`;
    // A run opens the Results tab by itself: let that land before going on, or the two navigations race (WebKit).
    await expect(page).toHaveURL(/[?&]tab=results/, NAV);
    await open(page, results);
    await expect(page.getByText(/Hand-entered: Mill EPD 2025/).first()).toBeVisible(NAV);
    await expect(page.getByText('(source not on record)')).toHaveCount(0);

    // Back to the library factor: the frozen run keeps the number it used.
    const listed = await api.as(user.token).get<{ factors: Array<{ category_id: number }> }>(`/api/flows/${flowId}/factor`);
    await api.as(user.token).del(`/api/flows/${flowId}/factor?category_id=${listed.factors[0].category_id}`);
    expect((await api.as(user.token).get<{ factors: unknown[] }>(`/api/flows/${flowId}/factor`)).factors).toEqual([]);
    await open(page, results);
    await expect(page.getByText(/Hand-entered: Mill EPD 2025/).first()).toBeVisible(NAV);
  });

  test('E2 your own factor on a flow with no factor at all, from the Inventory', async ({ api, newUser, signIn }) => {
    const user = await newUser('own-nofactor');
    const { projectId, caseId } = await workedExample(api, user);
    const fold = await idOf(api, user, caseId, 'Fold and tape');
    // A library substance with no climate factor in the study's method, measured in kg.
    const subs = (await api.as(user.token).get<{ substances: Array<{ substance_id: number; substance_name: string; unit?: string; climate_factor?: unknown }> }>(`/api/substances?method=${encodeURIComponent('TRACI 2.1')}`)).substances;
    const none = subs.find((s) => s.climate_factor == null && (s.unit ?? 'kg') === 'kg' && /^[A-Z]/.test(s.substance_name))!;
    expect(none, 'a substance with no TRACI climate factor').toBeTruthy();
    await api.as(user.token).post(`/api/components/${fold}/flows`, { substance_id: none.substance_id, flow_type: 'input', quantity: 0.5, unit: 'kg' });

    const { page } = await signIn(user);
    await open(page, `/project/${projectId}/case/${caseId}?tab=inventory`);
    const box = page.getByRole('textbox', { name: `${none.substance_name}, amount in kg`, exact: true });
    await expect(box).toBeVisible(NAV);
    const row = page.getByRole('row').filter({ has: box });
    await expect(row.getByText('No factor', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: `Edit more of ${none.substance_name}` }).click();
    await page.getByRole('button', { name: 'Use my own factor' }).click();
    const form = page.getByRole('group', { name: `Your own factor for ${none.substance_name}` });
    await form.getByLabel(/Your factor, in/).fill('1.2');
    await form.getByLabel('Where it comes from').fill('Supplier sheet 2024');
    await form.getByRole('button', { name: `Save your own factor for ${none.substance_name}` }).click();
    await expect(page.getByText(new RegExp(`Saved · your own factor for ${esc(none.substance_name)}: 1\\.2 kg CO₂-eq per kg`))).toBeVisible();
    await expect.poll(async () => (await inventory(api, user, caseId)).find((r) => r.substance === none.substance_name)?.climate?.tag).toBe('hand');
    const inv = (await inventory(api, user, caseId)).find((r) => r.substance === none.substance_name)!;
    expect(inv.climate!.impact).toBeCloseTo(0.6, 9);
  });
});

test.describe('editor hardening: costs', () => {
  test('B1 a metal and a labor rate show their number first; only Save stores it, and the Saved line is on that cost', async ({ api, newUser, signIn }) => {
    const user = await newUser('cost-preview');
    const { projectId, caseId } = await workedExample(api, user);
    const cut = await idOf(api, user, caseId, '10. Cut blank');
    const weld = await idOf(api, user, caseId, '20. Weld tab');
    const weldLabor = await costOf(api, user, weld, 'labor');
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    await page.getByRole('radio', { name: 'Cost', exact: true }).click();
    await step(page, '10. Cut blank').click();
    const p = panel(page, '10. Cut blank');
    await p.getByRole('button', { name: /^Material/ }).click();
    await p.getByRole('combobox', { name: 'Metal', exact: true }).selectOption({ label: 'Steel' });
    await p.getByLabel('Kilograms per unit').fill('0.8');
    await p.getByRole('button', { name: 'Look up the price of steel' }).click();
    await expect(p.getByText('0.8 kg × $0.95/kg = $0.76 · Steel, hot-rolled')).toBeVisible();
    expect(await costOf(api, user, cut, 'material')).toBeNull();
    await p.getByRole('button', { name: 'Save the price of steel' }).click();
    await inView(page, 'Saved · material $0.76 on 10. Cut blank');
    expect(await costOf(api, user, cut, 'material')).toBeCloseTo(0.76, 6);

    // Labor on the weld tab: Pick shows the cost; the stored one stays until Save.
    await step(page, '20. Weld tab').click();
    const w = panel(page, '20. Weld tab');
    await w.getByRole('button', { name: /^Labor/ }).click();
    await w.getByLabel('Hours per unit').fill('0.02');
    await w.getByRole('button', { name: /^Pick Production worker, average · US/ }).click();
    const preview = w.getByRole('group', { name: 'Not saved yet' });
    await expect(preview).toContainText('0.02 h × $');
    expect(await costOf(api, user, weld, 'labor')).toBe(weldLabor);
    await w.getByRole('button', { name: /^Save the labor cost/ }).click();
    await expect(w.getByText(/Saved · labor \$\d+\.\d\d on 20\. Weld tab/)).toBeVisible();
    expect(await costOf(api, user, weld, 'labor')).not.toBe(weldLabor);
  });

  test('E5 the flows\' cost never replaces a stored cost in one click', async ({ api, newUser, signIn }) => {
    const user = await newUser('cost-choice');
    const { projectId, caseId } = await workedExample(api, user);
    const fold = await idOf(api, user, caseId, 'Fold and tape');
    const subs = (await api.as(user.token).get<{ substances: Array<{ substance_id: number; substance_name: string }> }>('/api/substances')).substances;
    const cardboard = subs.find((s) => /^Cardboard\b/.test(s.substance_name))!;
    await api.as(user.token).post(`/api/components/${fold}/flows`, { substance_id: cardboard.substance_id, flow_type: 'input', quantity: 0.2, unit: 'kg' });
    await api.as(user.token).put(`/api/components/${fold}/costs`, { kind: 'material', mode: 'entered', amount: 85 });

    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    await page.getByRole('button', { name: 'Hide panel' }).click();
    await step(page, 'Fold and tape').click();
    await page.getByRole('button', { name: 'Show panel' }).click();
    const p = panel(page, 'Fold and tape');
    await expect(p.getByText('Material cost from these flows: $0.12 (now $85.00)')).toBeVisible(NAV);
    await expect(p.getByRole('radio', { name: 'Keep $85.00 (what is stored)' })).toBeChecked();
    await expect(p.getByRole('button', { name: 'Save the material cost from these flows' })).toBeDisabled();
    expect(await costOf(api, user, fold, 'material')).toBe(85);
    await p.getByRole('radio', { name: 'Use $0.12 from these flows' }).check();
    await p.getByRole('button', { name: 'Save the material cost from these flows' }).click();
    await expect(p.getByText('Saved · material from the flows on Fold and tape: $0.12')).toBeVisible();
    expect(await costOf(api, user, fold, 'material')).toBeCloseTo(0.12, 6);
  });
});

test.describe('editor hardening: the Inventory', () => {
  test('E1 every part of a flow changes from the Inventory, each by Save', async ({ api, newUser, signIn }) => {
    const user = await newUser('inv-edit');
    const { projectId, caseId } = await workedExample(api, user);
    const cut = await idOf(api, user, caseId, '10. Cut blank');
    const weld = await idOf(api, user, caseId, '20. Weld tab');
    const { page } = await signIn(user);
    const sent = writes(page);
    await open(page, `/project/${projectId}/case/${caseId}?tab=inventory`);
    const box = page.getByRole('textbox', { name: 'Steel, amount in kg', exact: true });
    await expect(box).toBeVisible(NAV);
    const row = () => page.getByRole('row').filter({ has: page.getByRole('textbox', { name: /^Steel, amount in/ }) });

    // Amount and unit: 0.80 kg → 0.9 kg, Enter sends nothing, Save stores it.
    await box.fill('0.9');
    await box.press('Enter');
    expect(sent.filter((s) => s.startsWith('PUT /api/flows'))).toEqual([]);
    await row().getByRole('button', { name: 'Save Steel on 10. Cut blank' }).click();
    await expect(row().getByText('Saved · Steel 0.90 kg on 10. Cut blank')).toBeVisible();
    expect(Number((await flowsOf(api, user, cut)).find((f) => f.substance_name === 'Steel')!.quantity)).toBe(0.9);

    // The step it is on: moved to the weld tab.
    await row().getByRole('button', { name: 'Edit more of Steel' }).click();
    await page.getByRole('combobox', { name: 'Step for Steel' }).selectOption(String(weld));
    await row().getByRole('button', { name: 'Save Steel on 10. Cut blank' }).click();
    await expect(page.getByText('Saved · Steel 0.90 kg on 20. Weld tab').first()).toBeVisible();
    await expect.poll(async () => (await flowsOf(api, user, weld)).some((f) => f.substance_name === 'Steel')).toBe(true);
    expect((await flowsOf(api, user, cut)).some((f) => f.substance_name === 'Steel')).toBe(false);

    // The substance: Steel → Aluminum.
    await row().getByRole('button', { name: 'Edit more of Steel' }).click();
    await page.getByRole('button', { name: 'Change substance' }).click();
    await page.getByRole('textbox', { name: 'Find a substance for Steel' }).fill('Aluminum');
    await page.getByRole('option', { name: /^Aluminum/ }).first().click();
    await row().getByRole('button', { name: 'Save Steel on 20. Weld tab' }).click();
    await expect(page.getByText(/Saved · Aluminum 0\.90 kg on 20\. Weld tab/).first()).toBeVisible();
    await expect.poll(async () => (await flowsOf(api, user, weld)).some((f) => f.substance_name === 'Aluminum')).toBe(true);

    // Delete, after the confirm.
    const alu = page.getByRole('row').filter({ has: page.getByRole('textbox', { name: 'Aluminum, amount in kg' }) });
    // Its Edit more is still open from the substance change: open it only if closed.
    const more = alu.getByRole('button', { name: 'Edit more of Aluminum' });
    if ((await more.getAttribute('aria-expanded')) !== 'true') await more.click();
    await page.getByRole('button', { name: 'Delete flow' }).click();
    await page.getByRole('alertdialog', { name: 'Delete this flow?' }).getByRole('button', { name: 'Delete flow' }).click();
    await expect(page.getByText('Deleted · Aluminum on 20. Weld tab')).toBeVisible();
    expect((await flowsOf(api, user, weld)).some((f) => f.substance_name === 'Aluminum')).toBe(false);
  });

  test('E3 E4 costs sit on the rows with the math, a step with no flow says it adds no impact, a step cost saves by Save, no sideways scroll', async ({ api, newUser, signIn }) => {
    const user = await newUser('inv-costs');
    const { projectId, caseId } = await workedExample(api, user);
    const cure = await idOf(api, user, caseId, 'Cure 20 min');
    const { page } = await signIn(user);
    await open(page, `/project/${projectId}/case/${caseId}?tab=inventory`);
    await expect(page.getByRole('textbox', { name: 'Steel, amount in kg', exact: true })).toBeVisible(NAV);

    // Impact math on the flow's row: amount × factor = impact.
    const steel = page.getByRole('row').filter({ has: page.getByRole('textbox', { name: 'Steel, amount in kg', exact: true }) });
    await expect(steel).toContainText(/0\.80 kg × [\d.]+ kg CO₂-eq per kg = [\d.]+ kg CO₂-eq/);

    // Cure 20 min has a cost and no flow: its group says so. Shear blank's labor sits as a step cost row.
    const cureGroup = page.getByRole('rowheader', { name: /^Cure 20 min/ });
    await expect(cureGroup).toContainText('Adds no impact: no flow on this step');
    const labor = page.getByRole('row', { name: /^Labor Shear blank · a step cost/ });
    await expect(labor).toContainText(/0\.0033 h × \$[\d.]+\/h/);

    // Cure 20 min's equipment cost ($0.05, entered) edits in place and saves by Save.
    const equipment = page.getByRole('row', { name: /^Equipment Cure 20 min · a step cost/ });
    await expect(equipment).toContainText('$0.05');
    await equipment.getByRole('button', { name: 'Edit the equipment cost on Cure 20 min' }).click();
    await page.getByLabel('Equipment cost in dollars').fill('0.07');
    expect(await costOf(api, user, cure, 'equipment')).toBeCloseTo(0.05, 6);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved · equipment on Cure 20 min: $0.07')).toBeVisible();
    expect(await costOf(api, user, cure, 'equipment')).toBeCloseTo(0.07, 6);

    // One table, no sideways scroll.
    const card = page.getByRole('region', { name: 'Flows' });
    const wide = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(wide).toBeLessThanOrEqual(1);
    await expect(page.locator('.ws-inv table')).toHaveCount(1);
  });

  test('C4 a read-only case shows plain values and says why, in the panel and the Inventory', async ({ api, newUser, signIn }) => {
    const user = await newUser('read-only');
    const { projectId, baseCaseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, baseCaseId);
    await step(page, '10. Cut blank').click();
    const p = panel(page, '10. Cut blank');
    await expect(p.getByText('Read-only: make your own copy to change it.')).toBeVisible();
    await expect(p.getByRole('textbox')).toHaveCount(0);
    await expect(p.getByRole('combobox')).toHaveCount(0);
    await expect(p.locator('.ws-flow').filter({ hasText: 'Steel' }).first()).toContainText('0.80 kg');

    await page.getByRole('tab', { name: /^Inventory/ }).click();
    const card = page.getByRole('region', { name: 'Flows' });
    await expect(card.getByText('Read-only: make your own copy to change it.')).toBeVisible();
    await expect(card.getByRole('textbox')).toHaveCount(0);
    await expect(card.getByRole('row').filter({ hasText: 'Steel' }).first()).toContainText('0.80 kg');
  });
});
