/**
 * Inside a case (the workspace, E03 to E04, E14): F6 the process tree, F7
 * flows, F8 costs. docs/flows/USER_FLOWS.md §F6–F8. Every test starts from
 * its own account's copy of the bracket study, so tests never share data.
 *
 * The workspace's tree is one Tab stop (role tree) holding its steps (role
 * treeitem, named "<name>, <tier>"); a step's menu (E03c) opens with a right
 * click or the M key; the panel beside the tree is the selected step's.
 */
import type { Page } from '@playwright/test';
import type { Api, ApiUser } from '../support/api';
import { openCase, workedExample } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { expectToast, settle } from '../support/ui';

type Component = { component_id: number; component_name: string; parent_component_id: number | null; component_type?: string };

async function components(api: Api, user: ApiUser, caseId: number): Promise<Component[]> {
  return (await api.as(user.token).get<{ components: Component[] }>(`/api/cases/${caseId}/components`)).components;
}

const step = (page: Page, name: string) => page.getByRole('treeitem', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });

/**
 * A step's menu by right click. The step panel floats over the right of the
 * tree, as it does for a person, so the panel is hidden first (Hide panel).
 */
async function menuOf(page: Page, name: string) {
  const hide = page.getByRole('button', { name: 'Hide panel' });
  if (await hide.isVisible()) await hide.click();
  await step(page, name).click({ button: 'right' });
  const menu = page.getByRole('menu', { name: `${name} menu` });
  await expect(menu).toBeVisible();
  return menu;
}

test.describe('F6 process tree', () => {
  test('add a step under the product, then rename it from its menu', async ({ api, newUser, signIn }) => {
    const user = await newUser('tree-add');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);

    await step(page, 'Painted steel bracket').click();
    const created = page.waitForResponse((r) => r.url().includes(`/api/cases/${caseId}/components`) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Add step', exact: true }).click();
    expect((await created).status()).toBe(201);
    // One tier below the product, named so it can be found and renamed.
    await expect(step(page, 'New step')).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'New step, Machine / line' })).toBeVisible();

    // The new step is selected: M opens its menu from the keyboard (E03c).
    await page.getByRole('tree').focus();
    await page.keyboard.press('m');
    const menu = page.getByRole('menu', { name: 'New step menu' });
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Rename' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rename step' });
    await dialog.getByLabel('Name').fill('Inspection line');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(step(page, 'Inspection line')).toBeVisible();

    const saved = (await components(api, user, caseId)).find((c) => c.component_name === 'Inspection line');
    expect(saved?.parent_component_id).not.toBeNull();
    expect(saved?.component_type).toBe('machine_line');
  });

  test.describe('delete', () => {
    /** Adds "Finishing" (subprocess) with "Degrease" (operation) under it. */
    async function withSubtree(api: Api, user: ApiUser, caseId: number) {
      const list = await components(api, user, caseId);
      const product = list.find((c) => c.parent_component_id == null)!;
      const post = (body: object) => api.as(user.token).post<{ component: { component_id: number } }>(`/api/cases/${caseId}/components`, body);
      const finishing = (await post({ component_name: 'Finishing', component_type: 'machine_line', parent_component_id: product.component_id })).component
        .component_id;
      await post({ component_name: 'Degrease', component_type: 'subprocess', parent_component_id: finishing });
    }

    test('the confirm says what goes; Cancel deletes nothing, Delete step takes the subtree', async ({ api, newUser, signIn }) => {
      const user = await newUser('tree-del');
      const { projectId, caseId } = await workedExample(api, user);
      await withSubtree(api, user, caseId);
      const { page } = await signIn(user);
      await openCase(page, projectId, caseId);

      const deletes: string[] = [];
      page.on('request', (r) => {
        if (r.method() === 'DELETE') deletes.push(r.url());
      });
      await (await menuOf(page, 'Finishing')).getByRole('menuitem', { name: 'Delete step' }).click();
      const confirm = page.getByRole('alertdialog', { name: 'Delete this step?' }).or(page.getByRole('dialog', { name: 'Delete this step?' }));
      await expect(confirm).toContainText('Finishing, its flows and every step below it are deleted.');
      // Cancel is the safe default and has focus.
      await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await confirm.getByRole('button', { name: 'Cancel' }).click();
      await expect(step(page, 'Finishing')).toBeVisible();
      expect(deletes).toEqual([]);

      await (await menuOf(page, 'Finishing')).getByRole('menuitem', { name: 'Delete step' }).click();
      const del = page.waitForResponse((r) => r.request().method() === 'DELETE' && /\/api\/components\/\d+/.test(r.url()));
      await confirm.getByRole('button', { name: 'Delete step' }).click();
      expect((await del).status()).toBe(200);
      await expect(step(page, 'Finishing')).toHaveCount(0);
      await expect(step(page, 'Degrease')).toHaveCount(0);
      const names = (await components(api, user, caseId)).map((c) => c.component_name);
      expect(names).not.toContain('Finishing');
      expect(names).not.toContain('Degrease');
    });

    test('the product has no Delete step', async ({ api, newUser, signIn }) => {
      const user = await newUser('tree-root');
      const { projectId, caseId } = await workedExample(api, user);
      const { page } = await signIn(user);
      await openCase(page, projectId, caseId);
      const menu = await menuOf(page, 'Painted steel bracket');
      await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Delete step' })).toHaveCount(0);
    });
  });
});

test.describe('F7 flows', () => {
  test('add a flow, and a transport leg worked out from mass × distance', async ({ api, newUser, signIn }) => {
    const user = await newUser('flows');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    await step(page, '20. Weld tab').click();
    await page.getByRole('button', { name: '+ Add a flow to this step' }).click();

    // A plain input: 0.5 kg aluminium.
    await page.getByPlaceholder('Search substances…').fill('Aluminum');
    await page.getByRole('button', { name: /^Aluminum\b/ }).first().click();
    await page.getByPlaceholder('0.0').fill('0.5');
    await page.getByPlaceholder('kg').fill('kg');
    let posted = page.waitForResponse((r) => /\/api\/components\/\d+\/flows/.test(r.url()) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save flow' }).click();
    expect((await posted).status()).toBe(201);
    await expectToast(page, 'Flow added');

    // A transport leg: 0.85 t over 450 km = 382.5 tkm.
    await page.getByRole('button', { name: '+ Add a flow to this step' }).click();
    await page.getByPlaceholder('Search substances…').fill('Transport, truck, regional');
    await page.getByRole('button', { name: /^Transport, truck, regional\b/ }).first().click();
    await expect(page.getByText('Transport leg: enter mass and distance, we compute tonne-km')).toBeVisible();
    await page.getByPlaceholder('e.g. 1.2').fill('0.85');
    await page.getByPlaceholder('e.g. 450').fill('450');
    await expect(page.getByText('= 382.5 tkm')).toBeVisible();
    await expect(page.getByPlaceholder('0.0')).toHaveValue('382.5');
    posted = page.waitForResponse((r) => /\/api\/components\/\d+\/flows/.test(r.url()) && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save flow' }).click();
    const res = await posted;
    expect(res.status()).toBe(201);
    expect(res.request().postDataJSON()).toMatchObject({ quantity: 382.5, unit: 'tkm', transport_mass_kg: 850, transport_distance_km: 450 });

    // Both are on the step now, with their amounts.
    const weldId = (await components(api, user, caseId)).find((c) => c.component_name === '20. Weld tab')!.component_id;
    const flows = (await api.as(user.token).get<{ flows: Array<{ substance_name: string; quantity: number | string }> }>(`/api/components/${weldId}/flows`)).flows;
    expect(flows.map((f) => [f.substance_name, Number(f.quantity)])).toEqual(
      expect.arrayContaining([
        ['Aluminum', 0.5],
        ['Transport, truck, regional', 382.5],
      ]),
    );
  });
});

test.describe('F8 costs', () => {
  test('a cost of 0 is stored as 0, and Clear this cost puts it back to not set', async ({ api, newUser, signIn }) => {
    const user = await newUser('costs');
    const { projectId, caseId } = await workedExample(api, user);
    const cutId = async () => (await components(api, user, caseId)).find((c) => c.component_name === '10. Cut blank')!.component_id;
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    // The Cost view: the panel shows the selected step's costs (E14).
    await page.getByRole('radio', { name: 'Cost', exact: true }).click();
    await step(page, '10. Cut blank').click();

    await page.getByRole('button', { name: /^Material/ }).click();
    await page.getByLabel('Material cost in dollars').fill('0');
    const put = page.waitForResponse((r) => r.url().includes('/costs') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await put).status()).toBe(200);
    await expect(page.getByText('Saved · material on 10. Cut blank')).toBeVisible();
    let row = (await api.as(user.token).get<{ component: Record<string, unknown> }>(`/api/components/${await cutId()}`)).component;
    expect(Number(row.material_cost)).toBe(0);
    expect(row.material_cost).not.toBeNull();

    await page.reload();
    await settle(page);
    await page.getByRole('radio', { name: 'Cost', exact: true }).click();
    await step(page, '10. Cut blank').click();
    await page.getByRole('button', { name: /^Material/ }).click();
    const cleared = page.waitForResponse((r) => r.url().includes('/costs?kind=material') && r.request().method() === 'DELETE');
    await page.getByRole('button', { name: 'Clear this cost' }).click();
    expect((await cleared).status()).toBe(200);
    await expect(page.getByRole('button', { name: /^Material.*Not set/ })).toBeVisible();
    row = (await api.as(user.token).get<{ component: Record<string, unknown> }>(`/api/components/${await cutId()}`)).component;
    expect(row.material_cost).toBeNull();
  });
});
