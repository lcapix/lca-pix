/**
 * Kept rows of the case editor. E15, E17 and E18 are exercised by the
 * journeys, so their ids sit on those titles instead of a second check.
 */
import { workedExample, openCase } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { note, row } from '../support/parity';
import { open } from '../support/ui';

const step = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('treeitem', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });

test('E01 E02 E03 E04 E06 E07 E16 E19 the add-step form and the step panel', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-add');
  const { projectId, caseId } = await workedExample(api, user);
  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await step(page, 'Painted steel bracket').click();
  await row(page.getByRole('button', { name: 'Add step', exact: true }), 'E01', 'Add a step, choosing tier and parent');
  await page.getByRole('button', { name: 'Add step', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add a step' });
  await expect.soft(form.getByLabel('Parent'), note('E01', 'Parent')).toBeVisible();
  await expect.soft(form.getByRole('radio', { name: 'Machine / line' }), note('E01', 'Tier')).toBeVisible();
  await expect.soft(form.getByLabel('Name'), note('E01', 'Name')).toBeVisible();
  await form.getByRole('button', { name: 'Cancel' }).click();
  await row(page.getByLabel('Step name'), 'E03', 'Rename a step');
  await row(page.getByLabel('Life-cycle stage'), 'E19', 'Set a life-cycle stage');
  await row(page.getByLabel('Quantity'), 'E16', 'Scale the product');
  await step(page, '10. Cut blank').click();
  await row(page.getByLabel('Move under'), 'E04', 'Move a step under another parent');
  await row(page.getByRole('button', { name: 'Delete step' }), 'E06', 'Delete a step and its children');
  await page.getByRole('button', { name: 'Delete step' }).click();
  await row(page.getByRole('button', { name: 'Delete it, keep its steps' }), 'E07', 'Delete a step but keep its children');
});

test('G127 G128 old step pages open the case', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-redirect');
  const { projectId, caseId } = await workedExample(api, user);
  const comps = (await api.as(user.token).get<{ components: Array<{ component_id: number; component_name: string }> }>(`/api/cases/${caseId}/components`)).components;
  const cut = comps.find((c) => c.component_name === '10. Cut blank')!;
  const { page } = await signIn(user);
  await page.goto(`/project/${projectId}/case/${caseId}/component/new`);
  await expect.soft(page.getByRole('dialog', { name: 'Add a step' }), note('G127', 'Add step form')).toBeVisible();
  await page.goto(`/project/${projectId}/case/${caseId}/component/${cut.component_id}/edit`);
  await expect.soft(page.getByLabel('Step name'), note('G128', 'The step is selected')).toHaveValue('10. Cut blank');
});

test('E08 E09 E11 E12 E13 a flow can change, and a parent step warns first', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-flow');
  const { projectId, caseId } = await workedExample(api, user);
  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await step(page, 'Painted steel bracket').click();
  await expect.soft(page.getByText(/Flows usually go on the lowest step/), note('E08', 'Warn before a flow on a step that has steps under it')).toBeVisible();

  await step(page, '10. Cut blank').click();
  const flow = page.locator('.ws-flow').first();
  await row(flow.getByRole('button', { name: 'Change substance' }), 'E09', "Swap a flow's substance");
  await row(flow.getByLabel(/Unit for /), 'E11', "Change a flow's unit");
  await row(flow.getByLabel(/Direction for /), 'E12', "Change a flow's direction");
  await row(flow.getByRole('button', { name: 'Delete flow' }), 'E13', 'Delete a flow');
});

test('E10 E14 change a flow amount, and use your own factor when the region fell back', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-edit');
  const { projectId, caseId } = await workedExample(api, user);
  const as = api.as(user.token);
  const comps = (await as.get<{ components: Array<{ component_id: number; component_name: string }> }>(`/api/cases/${caseId}/components`)).components;
  const cut = comps.find((c) => c.component_name === '10. Cut blank')!;
  const fallback = await globalOnlySubstance(as);
  await as.post(`/api/components/${cut.component_id}/flows`, {
    substance_id: fallback.id,
    flow_type: 'input',
    quantity: 1,
    unit: fallback.unit,
  });

  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await step(page, '10. Cut blank').click();

  await expect.soft(page.getByRole('textbox', { name: 'Steel', exact: true }), note('E10', "Change a flow's quantity")).toBeEnabled();
  await row(page.getByRole('button', { name: 'Use my own number' }), 'E14', 'Override a factor');
});

type Substance = { substance_id: number; substance_name: string; unit?: string };
type Factor = { substance_id: number; driver_name?: string; method_name?: string; category_name?: string; geographic_scope?: string };

/** A TRACI climate factor with no US row, so a US study falls back to Global. */
async function globalOnlySubstance(api: { get<T>(path: string): Promise<T> }): Promise<{ id: number; unit: string }> {
  const [factors, substances] = await Promise.all([
    api.get<{ factors: Factor[] }>('/api/driver-factors'),
    api.get<{ substances: Substance[] }>('/api/substances'),
  ]);
  const climate = (factors.factors ?? []).filter(
    (f) => f.method_name === 'TRACI 2.1' && /global warming|climate/i.test(f.category_name ?? ''),
  );
  const bySubstance = new Map<number, string[]>();
  for (const f of climate) {
    const list = bySubstance.get(f.substance_id) ?? [];
    list.push(String(f.geographic_scope ?? '').toLowerCase());
    bySubstance.set(f.substance_id, list);
  }
  const units = new Map(substances.substances.map((s) => [s.substance_id, s.unit || 'kg']));
  for (const [id, scopes] of bySubstance) {
    if (scopes.some((s) => s === 'us' || s === 'united states' || s === 'usa')) continue;
    if (!scopes.some((s) => s === 'global' || s === 'glo' || s === '')) continue;
    return { id, unit: units.get(id) || 'kg' };
  }
  throw new Error('parity: no TRACI climate factor falls back to Global, so E14 has nothing to show');
}

// Task 13: discovery findings on the editor (research/v1-h1-findings.md 1.3, 1.4, 3.10, 3.12).
test('1.3 1.4 1.10 3.12 the step menu renames over the old name and names the tier it adds; amount boxes have names', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const user = await newUser('parity-menu');
  const { projectId, caseId } = await workedExample(api, user);
  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);

  // 1.3: Rename opens with the name selected, so typing replaces it.
  await step(page, 'Cutting').click({ button: 'right' });
  await page.getByRole('menu', { name: 'Cutting menu' }).getByRole('menuitem', { name: 'Rename' }).click();
  const rename = page.getByRole('dialog', { name: 'Rename step' });
  await page.keyboard.type('Tube cutting');
  await expect.soft(rename.getByLabel('Name'), note('1.3', 'typing replaces the old name')).toHaveValue('Tube cutting');
  await rename.getByLabel('Name').press('ControlOrMeta+a');
  await page.keyboard.type('Cutting');
  await expect.soft(rename.getByLabel('Name'), note('1.3', 'select-all selects the box')).toHaveValue('Cutting');
  await rename.getByRole('button', { name: 'Cancel' }).click();

  // 1.4: a subprocess adds an operation, and the form opens on that parent; the lowest tier adds nothing.
  await step(page, 'Cutting').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add an operation below' }).click();
  const form = page.getByRole('dialog', { name: 'Add a step' });
  await expect.soft(form.getByLabel('Parent').locator('option:checked'), note('1.4', 'the form opens on that parent')).toHaveText(/Cutting/);
  await expect.soft(form.getByRole('radio', { name: 'Operation' }), note('1.4', 'the named tier is chosen')).toBeChecked();
  await form.getByRole('button', { name: 'Cancel' }).click();
  await step(page, 'Shear blank').click({ button: 'right' });
  await expect.soft(page.getByRole('menuitem', { name: /below$/ }), note('1.4', 'an elemental task adds nothing below')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // 3.12: the Inventory amount box is named for its flow, not "–".
  await page.getByRole('tab', { name: /^Inventory/ }).click();
  await expect.soft(page.getByRole('textbox', { name: 'Steel, amount in kg', exact: true }), note('3.12', 'the amount box has a name')).toBeVisible();

  // 1.10: Magic Insights sits below the tree card, not on its step list.
  const tree = page.getByRole('navigation', { name: 'The tree' });
  await expect.soft(tree.getByRole('button', { name: 'Magic Insights' }), note('1.10', 'not inside the step list')).toHaveCount(0);
  const treeBox = await tree.boundingBox();
  const magicBox = await page.getByRole('button', { name: 'Magic Insights' }).first().boundingBox();
  expect.soft(treeBox && magicBox && magicBox.y >= treeBox.y + treeBox.height, note('1.10', 'below the tree card')).toBe(true);
});

test('3.10 an amount changed in another tab is not overwritten silently', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const user = await newUser('parity-tabs');
  const { projectId, caseId } = await workedExample(api, user);
  const { context, page: a } = await signIn(user);
  const b = await context.newPage();
  for (const p of [a, b]) {
    await open(p, `/project/${projectId}/case/${caseId}?tab=inventory`);
    await expect(p.getByRole('textbox', { name: 'Steel, amount in kg', exact: true })).toBeVisible();
  }
  const boxB = b.getByRole('textbox', { name: 'Steel, amount in kg', exact: true });
  await boxB.fill('7.25');
  await boxB.press('Enter');
  await expect(b.getByText(/Saved · Steel 7.25 kg/)).toBeVisible();

  const boxA = a.getByRole('textbox', { name: 'Steel, amount in kg', exact: true });
  await boxA.fill('9.5');
  await boxA.press('Enter');
  await expect.soft(a.getByText(/This flow changed in another tab or by someone else: it is now 7.25 kg/), note('3.10', 'the second tab is told')).toBeVisible();
  await boxA.press('Enter');
  await expect.soft(a.getByText(/Saved · Steel 9\.50? kg/), note('3.10', 'saving again goes ahead')).toBeVisible();
});

test('E23 E24 a step keeps its description and its allocation', async ({ api, newUser, signIn }) => {
  const user = await newUser('parity-alloc');
  const { projectId, caseId } = await workedExample(api, user);
  const { page } = await signIn(user);
  await openCase(page, projectId, caseId);
  await step(page, '10. Cut blank').click();

  const desc = page.getByLabel('Step description');
  await row(desc, 'E23', 'Edit a step description');
  await desc.fill('Shear cut from coil');
  await desc.locator('xpath=..').getByRole('button', { name: 'Save' }).click();
  await expect.soft(page.getByText('Saved · 10. Cut blank').first(), note('E23', 'saved line')).toBeVisible();

  const alloc = page.getByRole('group', { name: 'Allocation' });
  await row(alloc.getByLabel('Allocation method'), 'E24', 'Allocate a multi-output step');
  await alloc.getByLabel('Allocation method').selectOption('physical');
  await alloc.getByRole('button', { name: 'Save allocation' }).click();
  await expect.soft(alloc.getByRole('alert'), note('E24', 'a share is required')).toContainText('percent');
  await alloc.getByLabel(/Share that belongs/).fill('80');
  await alloc.getByRole('button', { name: 'Save allocation' }).click();
  await expect.soft(alloc.getByRole('alert'), note('E24', 'a basis is required')).toContainText('basis');
  await alloc.getByLabel('Allocation basis').fill('by mass: 80 kg of 100 kg output');
  await alloc.getByRole('button', { name: 'Save allocation' }).click();
  await expect.soft(page.getByText(/keeps 80%/).first(), note('E24', 'saved')).toBeVisible();

  // Stored as the API names it, and the import-free description round-trips.
  const comps = (await api.as(user.token).get<{ components: Array<Record<string, any>> }>(`/api/cases/${caseId}/components`)).components;
  const cut = comps.find((c) => c.component_name === '10. Cut blank')!;
  expect.soft(Number(cut.allocation_factor), note('E24', 'share stored 0..1')).toBeCloseTo(0.8, 6);
  expect.soft(cut.allocation_method, note('E24', 'method')).toBe('physical');
  expect.soft(cut.allocation_note, note('E24', 'basis')).toBe('by mass: 80 kg of 100 kg output');
  expect.soft(String(cut.description), note('E23', 'description stored')).toContain('Shear cut from coil');

  await page.reload();
  await step(page, '10. Cut blank').click();
  await expect.soft(page.getByText(/Allocated: 80% stays with this product/), note('E24', 'shown after reload')).toBeVisible();
});
