/**
 * v2-commercial stage-0 exit gate: the three v2 features re-homed onto the
 * modular base, exercised end to end against a real database (plan of record:
 * research/v2-financial-build-plan-2026-10-13.md, "Stage exit gates").
 *
 *  E1  appending a revised routing merges its steps: one created, none doubled
 *  E1b re-appending a routing keeps each step's labour unless told otherwise
 *  E1c the reviewer can replace a step's cost, or add to it, instead
 *  E2  appending a BOM creates no placeholder step, and a line goes where it is put
 *  E2b re-appending a BOM keeps each step's flows unless told otherwise
 *  E3  review edits: a renamed step keeps its cost; a duplicate name is refused
 *  E4  a typed wage rate saves as the user's, and survives a reload
 *  E5  "Run Hours Per Unit" is read (the 10x labour fix)
 *  E7  each step's cost in the import review, and on the step after Save
 *
 * E6 (the type-the-name delete gate) belonged to the classic editor's two-step
 * delete; the workspace has one confirm (case-editor.spec.ts). Deterministic
 * connectors only: no AI, no network. On the education screens (F2.2 to F2.6,
 * E14): the import's chips, Into and Save; a step's costs in the Cost view.
 */
import path from 'node:path';
import type { Page } from '@playwright/test';
import type { Api, ApiUser } from '../support/api';
import { openCase } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { E2E_DIR } from '../support/paths';
import { open } from '../support/ui';

const doc = (name: string) => path.join(E2E_DIR, 'fixtures', 'import', name);

type Comp = {
  component_id: number;
  component_name: string;
  parent_component_id: number | null;
  labor_cost: string | number | null;
  labor_hours: string | number | null;
  labor_occupation: string | null;
  material_cost: string | number | null;
};

async function components(api: Api, user: ApiUser, caseId: number): Promise<Comp[]> {
  const r = await api.as(user.token).get<{ components?: Comp[]; data?: Comp[] }>(`/api/cases/${caseId}/components`);
  return (r.components ?? r.data ?? []) as Comp[];
}
const named = (list: Comp[], name: string) => list.find((c) => c.component_name === name);
const num = (v: unknown) => Number(v ?? 0);

/** A project of the user's own (TRACI 2.1 / US) to import into. */
async function ownProject(api: Api, user: ApiUser): Promise<number> {
  const as = api.as(user.token);
  const id = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Tube frame study', description: 'Stage 0 gate' })).project.project_id;
  await as.put(`/api/projects/${id}`, { lcia_method: 'TRACI 2.1', region_code: 'US', functional_unit: '1 tube frame' });
  return id;
}

const NAV = { timeout: 90_000 };

/** Pick a document on the import page (F2.2) and press Check what we read. */
async function preview(
  page: Page,
  projectId: number,
  opts: { connector: 'routing' | 'bom'; file: string; caseId?: number; product?: string; lot?: string },
) {
  await open(page, `/project/${projectId}/import`, { ready: 'What kind of file is it?' });
  await page.getByRole('radio', { name: opts.connector === 'bom' ? 'Bill of materials' : 'Routing' }).click();
  const into = page.getByLabel('Into');
  if (await into.count()) await into.selectOption(opts.caseId ? String(opts.caseId) : '');
  await page.locator('input[type="file"]').setInputFiles(doc(opts.file));
  if (opts.product || opts.lot) {
    await page.getByText('More details (optional)').click();
    if (opts.product) await page.getByPlaceholder('e.g. Aluminium enclosure').fill(opts.product);
    if (opts.lot) await page.getByPlaceholder('e.g. 25').fill(opts.lot);
  }
  const res = page.waitForResponse((r) => r.url().includes('/api/ingest/preview'), NAV);
  await page.getByRole('button', { name: /^Check what we read/ }).click();
  expect((await res).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible(NAV);
}

/** Save the checked plan; returns the apply response body. */
async function apply(page: Page, appending: boolean): Promise<any> {
  const res = page.waitForResponse((r) => r.url().includes('/api/ingest/apply'), NAV);
  await page.getByRole('button', { name: appending ? /Save \d+ lines? to / : /Save \d+ steps? to a new case$/ }).click();
  const r = await res;
  expect(r.status(), await r.text()).toBe(appending ? 200 : 201);
  return r.json();
}

/**
 * A case built from the small routing: "Tube frame" → departments Fabrication
 * and Assembly → work centers SAW-01, WLD-01, PCK-01 → 10/20/30 (9 steps).
 */
const ROUTING_STEPS = [
  '10. Cut tube', '20. Weld frame', '30. Pack', 'Assembly', 'Fabrication',
  'PCK-01 Pack station', 'SAW-01 Cold saw', 'Tube frame', 'WLD-01 TIG weld cell',
];
async function routingCase(page: Page, projectId: number): Promise<number> {
  await preview(page, projectId, { connector: 'routing', file: 'small-routing.csv', product: 'Tube frame' });
  const body = await apply(page, false);
  return body.case_id as number;
}

test.describe('v2 stage 0 gate', () => {
  test('E1 appending a revised routing merges its steps and creates only the new ones', async ({ api, newUser, signIn }) => {
    const user = await newUser('s0-append');
    const projectId = await ownProject(api, user);
    const { page } = await signIn(user);
    const caseId = await routingCase(page, projectId);
    const before = await components(api, user, caseId);
    expect(before.map((c) => c.component_name).sort()).toEqual(ROUTING_STEPS);

    // The revised routing adds one operation in a new department and work
    // center: Finishing → PNT-01 Paint booth → 25. Paint frame.
    await preview(page, projectId, { connector: 'routing', file: 'routing-revised.csv', caseId });
    // Every step is shown with what will happen to it, and why.
    for (const step of ['Finishing', 'PNT-01 Paint booth', '25. Paint frame']) {
      await expect(page.getByLabel(`What happens to ${step}`)).toHaveValue('create');
    }
    for (const step of ['Fabrication', 'Assembly', 'SAW-01 Cold saw', 'WLD-01 TIG weld cell', 'PCK-01 Pack station', '10. Cut tube', '20. Weld frame', '30. Pack']) {
      await expect(page.getByLabel(`What happens to ${step}`)).toHaveValue(/^attach:\d+$/);
    }
    // The new step's labour line goes to the new step, so nothing blocks apply.
    await expect(page.getByText('line(s) still need a step')).toHaveCount(0);
    const body = await apply(page, true);
    expect(body.steps_created).toBe(3);

    const after = await components(api, user, caseId);
    const names = after.map((c) => c.component_name);
    expect(names).toHaveLength(12);
    expect(new Set(names).size).toBe(12);
    const root = after.find((c) => c.parent_component_id == null)!;
    const finishing = named(after, 'Finishing')!;
    const booth = named(after, 'PNT-01 Paint booth')!;
    const paint = named(after, '25. Paint frame')!;
    expect(finishing.parent_component_id).toBe(root.component_id);
    expect(booth.parent_component_id).toBe(finishing.component_id);
    expect(paint.parent_component_id).toBe(booth.component_id);
    // 0.5 h run (setup left out: no lot size) × $21.00/h production worker.
    expect(num(paint.labor_cost)).toBeCloseTo(10.5, 2);

    // A third time: nothing new.
    await preview(page, projectId, { connector: 'routing', file: 'routing-revised.csv', caseId });
    const again = await apply(page, true);
    expect(again.steps_created).toBe(0);
    const third = (await components(api, user, caseId)).map((c) => c.component_name);
    expect(third).toHaveLength(12);
    expect(new Set(third).size).toBe(12);
  });

  test('E1b re-appending a routing keeps each step\'s labour unless told otherwise', async ({ api, newUser, signIn }) => {
    const user = await newUser('s0-relabour');
    const projectId = await ownProject(api, user);
    const { page } = await signIn(user);
    const caseId = await routingCase(page, projectId);
    const cut = num(named(await components(api, user, caseId), '10. Cut tube')!.labor_cost);
    expect(cut).toBeCloseTo(6.3, 2); // 0.3 h × $21.00/h

    await preview(page, projectId, { connector: 'routing', file: 'small-routing.csv', caseId });
    // Each step that already has the cost is listed, set to Keep.
    await expect(page.getByText('ALREADY COSTED · 3 STEPS')).toBeVisible();
    await expect(page.getByLabel('What to do with the labor cost of 10. Cut tube')).toHaveValue('keep');
    const body = await apply(page, true);
    expect(body.costs_kept).toBe(3);
    const after = await components(api, user, caseId);
    expect(num(named(after, '10. Cut tube')!.labor_cost)).toBeCloseTo(6.3, 2);
    expect(num(named(after, '20. Weld frame')!.labor_cost)).toBeCloseTo(20.66, 2);
  });

  test('E1c the reviewer can replace a step\'s cost, or add to it, instead', async ({ api, newUser, signIn }) => {
    const user = await newUser('s0-recost');
    const projectId = await ownProject(api, user);
    const { page } = await signIn(user);
    const caseId = await routingCase(page, projectId);

    // Cut tube's run time is now 0.5 h: replace its labour with the new figure.
    await preview(page, projectId, { connector: 'routing', file: 'routing-cut-retimed.csv', caseId });
    await page.getByLabel('What to do with the labor cost of 10. Cut tube').selectOption('replace');
    await page.getByLabel('What to do with the labor cost of 30. Pack').selectOption('add');
    const body = await apply(page, true);
    expect(body.costs_replaced).toBe(1);
    expect(body.costs_kept).toBe(1);

    const after = await components(api, user, caseId);
    const cut = named(after, '10. Cut tube')!;
    const pack = named(after, '30. Pack')!;
    expect(num(cut.labor_cost)).toBeCloseTo(10.5, 2); // 0.5 h × $21.00
    expect(num(cut.labor_hours)).toBeCloseTo(0.5, 4); // hours follow the replaced cost
    expect(num(pack.labor_cost)).toBeCloseTo(12.6, 2); // 6.30 + 6.30
    expect(num(pack.labor_hours)).toBeCloseTo(0.6, 4); // 0.3 + 0.3
    expect(num(named(after, '20. Weld frame')!.labor_cost)).toBeCloseTo(20.66, 2); // kept
  });

  test('E2 appending a BOM creates no placeholder step, and a line goes where it is put', async ({ api, newUser, signIn }) => {
    const user = await newUser('s0-bom');
    const projectId = await ownProject(api, user);
    const { page } = await signIn(user);
    const caseId = await routingCase(page, projectId);
    const weld = named(await components(api, user, caseId), '20. Weld frame')!;

    await preview(page, projectId, { connector: 'bom', file: 'small-bom.csv', caseId });
    await expect(page.getByLabel('What happens to Purchased materials')).toHaveValue('skip');
    // The box is suggested for 30. Pack (its op seq); put it on 20. Weld frame instead.
    const boxRow = page.locator('tr', { hasText: 'Shipping box' }).last();
    await boxRow.getByLabel('Step this line is used at').selectOption(String(weld.component_id));
    const body = await apply(page, true);
    expect(body.steps_created).toBe(0);

    const after = await components(api, user, caseId);
    expect(after.map((c) => c.component_name)).not.toContain('Purchased materials');
    expect(after).toHaveLength(ROUTING_STEPS.length);
    expect(num(named(after, '20. Weld frame')!.material_cost)).toBeCloseTo(2, 2);
    expect(num(named(after, '30. Pack')!.material_cost)).toBe(0);
    expect(num(named(after, '10. Cut tube')!.material_cost)).toBeCloseTo(85, 2);
  });

  test('E2b re-appending a BOM keeps each step\'s flows unless told otherwise', async ({ api, newUser, signIn }) => {
    const user = await newUser('s0-reflow');
    const projectId = await ownProject(api, user);
    const { page } = await signIn(user);
    const caseId = await routingCase(page, projectId);
    await preview(page, projectId, { connector: 'bom', file: 'small-bom.csv', caseId });
    await apply(page, true);
    const flowsOnce = (await components(api, user, caseId)).reduce((n, c: any) => n + Number(c.flow_count ?? 0), 0);
    expect(flowsOnce).toBeGreaterThan(0);

    await preview(page, projectId, { connector: 'bom', file: 'small-bom.csv', caseId });
    // Each flow the case already has is listed, set to Keep.
    await expect(page.getByText(/ALREADY IN THE CASE · \d+ FLOWS?/)).toBeVisible();
    const choices = page.getByLabel(/^What to do with the .+ input of /);
    await expect(choices.first()).toHaveValue('keep');
    expect(await choices.count()).toBe(flowsOnce);
    const body = await apply(page, true);
    expect(body.flows_kept).toBe(flowsOnce);
    const flowsTwice = (await components(api, user, caseId)).reduce((n, c: any) => n + Number(c.flow_count ?? 0), 0);
    expect(flowsTwice).toBe(flowsOnce);
  });

  test('E3 review edits: a renamed step keeps its cost, a duplicate name is refused', async ({ api, newUser, signIn }) => {
    const user = await newUser('s0-edit');
    const projectId = await ownProject(api, user);
    const { page } = await signIn(user);
    await preview(page, projectId, { connector: 'routing', file: 'small-routing.csv', product: 'Edited frame' });

    await page.getByLabel('Name of 30. Pack').fill('10. Cut tube');
    let applied = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/ingest/apply')) applied = true;
    });
    await page.getByRole('button', { name: /Save \d+ steps? to a new case$/ }).click();
    await expect(page.getByText('Two steps are both called "10. Cut tube". Names have to be unique in a case.')).toBeVisible();
    expect(applied).toBe(false);

    await page.getByLabel('Name of 30. Pack').fill('30. Pack');
    await page.getByLabel('Name of 20. Weld frame').fill('20. TIG weld frame');
    const body = await apply(page, false);
    const list = await components(api, user, body.case_id);
    const names = list.map((c) => c.component_name);
    expect(names).toContain('20. TIG weld frame');
    expect(names).not.toContain('20. Weld frame');
    // Its labour came along: 0.8 h × $25.83/h welder.
    expect(num(named(list, '20. TIG weld frame')!.labor_cost)).toBeCloseTo(20.66, 2);
  });

  test('E4 a typed wage rate saves as the user\'s and survives a reload', async ({ api, newUser, signIn }) => {
    const user = await newUser('s0-wage');
    const projectId = await ownProject(api, user);
    const { page } = await signIn(user);
    const caseId = await routingCase(page, projectId);

    // The step's costs, in the Cost view (E14): Labor → Look up a labor rate → your own rate.
    const openLabor = async () => {
      await openCase(page, projectId, caseId);
      await page.getByRole('radio', { name: 'Cost', exact: true }).click();
      await page.getByRole('treeitem', { name: /^20\. Weld frame, / }).click();
      await page.getByRole('button', { name: /^Labor/ }).click();
    };
    await openLabor();
    await page.getByLabel('Your rate in dollars per hour').fill('44');
    const saved = page.waitForResponse((r) => r.url().includes('/costs') && r.request().method() === 'PUT', NAV);
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText('Saved · your own labor rate on 20. Weld frame')).toBeVisible();

    const weld = named(await components(api, user, caseId), '20. Weld frame')!;
    expect(num(weld.labor_hours)).toBeCloseTo(0.8, 4);
    expect(num(weld.labor_cost)).toBeCloseTo(35.2, 2); // 0.8 h × $44

    await page.reload();
    await page.getByRole('radio', { name: 'Cost', exact: true }).click();
    await page.getByRole('treeitem', { name: /^20\. Weld frame, / }).click();
    await expect(page.getByRole('button', { name: /^Labor/ })).toContainText('$35.20');
  });

  test('E5 a "Run Hours Per Unit" header is read: 0.3875 h and $10.01, not ten times less', async ({ api, newUser, signIn }) => {
    const user = await newUser('s0-hours');
    const projectId = await ownProject(api, user);
    const { page } = await signIn(user);
    await preview(page, projectId, { connector: 'routing', file: 'routing-per-unit-header.csv', product: 'Weld test', lot: '20' });
    const body = await apply(page, false);
    const weld = named(await components(api, user, body.case_id), '10. TIG weld frame')!;
    // 0.35 h run + 0.75 h setup ÷ lot 20 = 0.3875 h × $25.83/h welder.
    expect(num(weld.labor_hours)).toBeCloseTo(0.3875, 4);
    expect(num(weld.labor_cost)).toBeCloseTo(10.01, 2);
  });

  test('E7 each step\'s cost in the import review, and on the step after Save', async ({ api, newUser, signIn }) => {
    const user = await newUser('s0-layout');
    const projectId = await ownProject(api, user);
    const { page } = await signIn(user);

    await preview(page, projectId, { connector: 'routing', file: 'small-routing.csv', product: 'Layout frame' });
    // 6.30 + 20.66 + 6.30 (0.3 h × $21.00 for Pack: setup left out).
    await expect(page.getByText(/\$33\.26 of cost in this document/)).toBeVisible();
    await expect(page.getByText('$20.66', { exact: true }).first()).toBeVisible();
    const body = await apply(page, false);

    // Each step's cost came along: the Cost view shows it with where it came from.
    await openCase(page, projectId, body.case_id);
    await page.getByRole('radio', { name: 'Cost', exact: true }).click();
    await page.getByRole('treeitem', { name: /^20\. Weld frame, / }).click();
    await expect(page.getByRole('button', { name: /^Labor/ })).toContainText('$20.66');
  });
});
