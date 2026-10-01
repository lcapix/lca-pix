/**
 * The case editor: F6 process tree, F7 environmental flows, F8 costs.
 * docs/flows/USER_FLOWS.md §F6–F8. Every test starts from its own account's
 * worked example, so tests never share data.
 */
import type { Page } from '@playwright/test';
import type { Api, ApiUser } from '../support/api';
import {
  inspector,
  openCase,
  openSection,
  outline,
  outlineRow,
  saveInspector,
  selectComponent,
  workedExample,
} from '../support/editor';
import { expect, test } from '../support/fixtures';
import { expectToast, settle } from '../support/ui';

type Component = { component_id: number; component_name: string; parent_component_id: number | null };

async function components(api: Api, user: ApiUser, caseId: number): Promise<Component[]> {
  return (await api.as(user.token).get<{ components: Component[] }>(`/api/cases/${caseId}/components`)).components;
}

/** Answer the native confirm() dialogs in order; returns the messages seen. */
function answerConfirms(page: Page, answers: boolean[]): string[] {
  const seen: string[] = [];
  page.on('dialog', async (d) => {
    seen.push(d.message());
    if (answers.shift()) await d.accept();
    else await d.dismiss();
  });
  return seen;
}

test.describe('F6 process tree', () => {
  test('add a component through the Add Component dialog', async ({ api, newUser, signIn }) => {
    const user = await newUser('tree-add');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);

    await outline(page).getByRole('button', { name: 'Add Component' }).click();
    const dialog = page.getByRole('dialog', { name: 'New component' });
    await expect(dialog).toBeVisible();
    // Guardrails §4 name this radiogroup "Process tier"; today it is "Component
    // type" (the contract test records the gap).
    await dialog.getByRole('radiogroup', { name: /Process tier|Component type/ }).getByRole('radio', { name: 'Operation' }).click();
    // The form's labels are not tied to their inputs: placeholders stand in
    // (recorded in the a11y baseline, rule "label").
    await dialog.getByPlaceholder('e.g. Cathode Coating').fill('40. Inspect and pack');
    const created = page.waitForResponse(
      (r) => r.url().includes(`/api/cases/${caseId}/components`) && r.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Create component' }).click();
    expect((await created).status()).toBe(201);

    await expect(dialog).toBeHidden();
    await expect(outlineRow(page, '40. Inspect and pack')).toBeVisible();
    const saved = (await components(api, user, caseId)).find((c) => c.component_name === '40. Inspect and pack');
    expect(saved?.parent_component_id).not.toBeNull();
  });

  test('change the product quantity through the scale dialog', async ({ api, newUser, signIn }) => {
    const user = await newUser('tree-qty');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);

    // Quantity lives on the product (the case's data basis): changing it asks
    // whether to scale the inputs or keep them.
    await selectComponent(page, 'Painted steel bracket');
    await inspector(page).getByRole('textbox', { name: 'Product quantity' }).fill('2');
    await inspector(page).getByRole('button', { name: 'Save', exact: true }).click();
    const scale = page.getByRole('dialog').filter({ hasText: 'Scale everything' });
    await expect(scale).toBeVisible();
    const put = page.waitForResponse((r) => /\/api\/components\/\d+/.test(r.url()) && r.request().method() === 'PUT');
    await scale.getByRole('button', { name: /My data already covers 2/ }).click();
    expect((await put).status()).toBe(200);
    await expectToast(page, 'Kept the inputs as entered; they now count as 2 units');

    await page.reload();
    await settle(page);
    await selectComponent(page, 'Painted steel bracket');
    await expect(inspector(page).getByRole('textbox', { name: 'Product quantity' })).toHaveValue('2');
    const product = (await components(api, user, caseId)).find((c) => c.parent_component_id == null)!;
    expect(product.component_name).toBe('Painted steel bracket');
  });

  test('change a step’s life-cycle stage in the inspector', async ({ api, newUser, signIn }) => {
    const user = await newUser('tree-stage');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);

    await selectComponent(page, '20. Weld tab');
    const stage = inspector(page).getByRole('combobox', { name: /Which stage of the product.s life/ });
    await openSection(page, 'Life-cycle stage', stage);
    await expect(stage).toHaveValue('production');
    await stage.selectOption({ label: 'Use' });
    await saveInspector(page);

    await page.reload();
    await settle(page);
    await selectComponent(page, '20. Weld tab');
    await openSection(page, 'Life-cycle stage', stage);
    await expect(stage).toHaveValue('use');
  });

  // BUG (data loss). handleSaveComponent awaits reloadComponents() and then
  // refills the form with loadFormFor(saved) for the node that was selected
  // when Save was clicked (stale closure, app/project/[projectId]/case/[caseId]/page.tsx:703-704;
  // reached from applyScale at :612). Select another step while that reload is
  // in flight and the inspector holds the PREVIOUS node's fields under the new
  // selection; the next Save PUTs them onto the new step. After a product
  // rescale this turns "20. Weld tab" into a second root "Painted steel
  // bracket" product. The reload is delayed here so the race is deterministic.
  test.fixme('switching steps while a save is still reloading keeps each step’s own fields', async ({ api, newUser, signIn }) => {
    const user = await newUser('tree-race');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);

    await selectComponent(page, 'Painted steel bracket');
    await inspector(page).getByRole('textbox', { name: 'Product quantity' }).fill('2');
    await inspector(page).getByRole('button', { name: 'Save', exact: true }).click();
    await page.route(`**/api/cases/${caseId}/components*`, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.getByRole('dialog').filter({ hasText: 'Scale everything' }).getByRole('button', { name: /My data already covers 2/ }).click();
    await selectComponent(page, '20. Weld tab');
    await page.waitForTimeout(2500); // the delayed reload lands
    await page.unroute(`**/api/cases/${caseId}/components*`);
    await expect(inspector(page).getByText('20. Weld tab', { exact: true }).first()).toBeVisible();
    await saveInspector(page);

    const list = await components(api, user, caseId);
    expect(list.filter((c) => c.parent_component_id == null)).toHaveLength(1);
    expect(list.map((c) => c.component_name)).toContain('20. Weld tab');
  });

  test.describe('delete', () => {
    /** Adds "Finishing" (subprocess) with "Degrease" (operation) under it. */
    async function withSubtree(api: Api, user: ApiUser, caseId: number) {
      const list = await components(api, user, caseId);
      const product = list.find((c) => c.parent_component_id == null)!;
      const post = (body: object) =>
        api.as(user.token).post<{ component: { component_id: number } }>(`/api/cases/${caseId}/components`, body);
      const finishing = (await post({ component_name: 'Finishing', component_type: 'subprocess', parent_component_id: product.component_id })).component.component_id;
      await post({ component_name: 'Degrease', component_type: 'operation', parent_component_id: finishing });
      return { productId: product.component_id };
    }

    test('delete a step with its subtree', async ({ api, newUser, signIn }) => {
      const user = await newUser('tree-del');
      const { projectId, caseId } = await workedExample(api, user);
      await withSubtree(api, user, caseId);
      const { page } = await signIn(user);
      await openCase(page, projectId, caseId);

      await selectComponent(page, 'Finishing');
      const seen = answerConfirms(page, [true]);
      const del = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().includes('children=delete'));
      await inspector(page).getByRole('button', { name: 'Delete', exact: true }).click();
      expect((await del).status()).toBe(200);
      expect(seen[0]).toContain('Delete "Finishing" and the 1 step under it');

      await expectToast(page, 'Deleted "Finishing" and the 1 step under it');
      await expect(outlineRow(page, 'Finishing')).toHaveCount(0);
      await expect(outlineRow(page, 'Degrease')).toHaveCount(0);
      const names = (await components(api, user, caseId)).map((c) => c.component_name);
      expect(names).not.toContain('Finishing');
      expect(names).not.toContain('Degrease');
    });

    test('delete a step but keep its children (they move up)', async ({ api, newUser, signIn }) => {
      const user = await newUser('tree-keep');
      const { projectId, caseId } = await workedExample(api, user);
      const { productId } = await withSubtree(api, user, caseId);
      const { page } = await signIn(user);
      await openCase(page, projectId, caseId);

      await selectComponent(page, 'Finishing');
      // Today's UI: two native confirms. Cancel on the first means "keep the
      // children"; OK on the second confirms it. (Target: one dialog with
      // "Delete subtree" / "Keep children (move up)" / "Cancel".)
      const seen = answerConfirms(page, [false, true]);
      const del = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().includes('children=reparent'));
      await inspector(page).getByRole('button', { name: 'Delete', exact: true }).click();
      expect((await del).status()).toBe(200);
      expect(seen[1]).toContain('Keep the 1 step directly under "Finishing"');

      await expectToast(page, 'Deleted "Finishing"; 1 step moved up');
      await expect(outlineRow(page, 'Finishing')).toHaveCount(0);
      await expect(outlineRow(page, 'Degrease')).toBeVisible();
      const degrease = (await components(api, user, caseId)).find((c) => c.component_name === 'Degrease');
      expect(degrease?.parent_component_id).toBe(productId);
    });

    test('cancelling both questions deletes nothing', async ({ api, newUser, signIn }) => {
      const user = await newUser('tree-cancel');
      const { projectId, caseId } = await workedExample(api, user);
      await withSubtree(api, user, caseId);
      const { page } = await signIn(user);
      await openCase(page, projectId, caseId);

      await selectComponent(page, 'Finishing');
      const seen = answerConfirms(page, [false, false]);
      await inspector(page).getByRole('button', { name: 'Delete', exact: true }).click();
      await expect.poll(() => seen.length).toBe(2);
      await expect(outlineRow(page, 'Finishing')).toBeVisible();
      expect((await components(api, user, caseId)).map((c) => c.component_name)).toContain('Finishing');
    });
  });
});

test.describe('F7 environmental flows', () => {
  test('add a flow, and a transport leg worked out from mass × distance', async ({ api, newUser, signIn }) => {
    const user = await newUser('flows');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    await selectComponent(page, '20. Weld tab');
    const pane = inspector(page);
    const addFlow = pane.getByRole('button', { name: 'Add flow' });
    await openSection(page, 'Environmental Flows', addFlow);

    // A plain input: 0.5 kg aluminium. The add-flow inputs have no accessible
    // names (labels not tied to them): placeholders stand in.
    await addFlow.click();
    await pane.getByPlaceholder('Search substances…').fill('Aluminum');
    await pane.getByRole('button', { name: /^Aluminum\b/ }).first().click();
    await pane.getByPlaceholder('0.0').fill('0.5');
    await pane.getByPlaceholder('kg').fill('kg');
    let posted = page.waitForResponse((r) => /\/api\/components\/\d+\/flows/.test(r.url()) && r.request().method() === 'POST');
    await pane.getByRole('button', { name: 'Save flow' }).click();
    expect((await posted).status()).toBe(201);
    await expectToast(page, 'Flow added');
    await expect(pane.getByRole('button', { name: 'Edit quantity of Aluminum' })).toBeVisible();

    // A transport leg: 0.85 t over 450 km = 382.5 tkm.
    await pane.getByRole('button', { name: 'Add flow' }).click();
    await pane.getByPlaceholder('Search substances…').fill('Transport, truck, regional');
    await pane.getByRole('button', { name: /^Transport, truck, regional\b/ }).first().click();
    await expect(pane.getByText('Transport leg — enter mass and distance, we compute tonne-km')).toBeVisible();
    await pane.getByPlaceholder('e.g. 1.2').fill('0.85');
    await pane.getByPlaceholder('e.g. 450').fill('450');
    await expect(pane.getByText('= 382.5 tkm')).toBeVisible();
    await expect(pane.getByPlaceholder('0.0')).toHaveValue('382.5');
    posted = page.waitForResponse((r) => /\/api\/components\/\d+\/flows/.test(r.url()) && r.request().method() === 'POST');
    await pane.getByRole('button', { name: 'Save flow' }).click();
    const res = await posted;
    expect(res.status()).toBe(201);
    const body = res.request().postDataJSON();
    expect(body).toMatchObject({ quantity: 382.5, unit: 'tkm', transport_mass_kg: 850, transport_distance_km: 450 });
    await expect(pane.getByRole('button', { name: 'Edit quantity of Transport, truck, regional' })).toBeVisible();
  });
});

test.describe('F8 costs', () => {
  test('a cost of 0 is stored as 0, and a cleared cost goes back to empty', async ({ api, newUser, signIn }) => {
    const user = await newUser('costs');
    const { projectId, caseId } = await workedExample(api, user);
    const { page } = await signIn(user);
    await openCase(page, projectId, caseId);
    await selectComponent(page, '10. Cut blank');
    const labor = inspector(page).getByRole('textbox', { name: 'Labor cost' });
    const energy = inspector(page).getByRole('textbox', { name: 'Energy cost' });
    await openSection(page, 'Costs', labor);

    await labor.fill('0');
    await energy.fill('12.5');
    await saveInspector(page);
    await page.reload();
    await settle(page);
    await selectComponent(page, '10. Cut blank');
    await openSection(page, 'Costs', labor);
    await expect(labor).toHaveValue('0');
    await expect(energy).toHaveValue('12.5');

    await energy.fill('');
    await saveInspector(page);
    await page.reload();
    await settle(page);
    await selectComponent(page, '10. Cut blank');
    await openSection(page, 'Costs', labor);
    await expect(energy).toHaveValue('');
    await expect(labor).toHaveValue('0');

    const row = (await api.as(user.token).get<{ component: Record<string, unknown> }>(
      `/api/components/${(await components(api, user, caseId)).find((c) => c.component_name === '10. Cut blank')!.component_id}`,
    )).component;
    expect(Number(row.labor_cost)).toBe(0);
    expect(row.energy_cost).toBeNull();
  });
});
