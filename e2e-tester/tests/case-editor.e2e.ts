/**
 * The case editor: F6 process tree (add through the Add Component dialog, edit
 * and save, delete with each choice), F7 environmental flows (a flow and a
 * transport leg), F8 costs (0 stays 0, a cleared cost goes empty).
 * docs/flows/USER_FLOWS.md §F6–F8 (same journeys as tests/e2e/journeys/case-editor.spec.ts).
 * Every test starts from its own account's worked example.
 */
import type { Browser } from '@e2e-dev/web';
import type { Api, ApiUser } from '../support/api.ts';
import { components, workedExample } from '../support/api.ts';
import { inspector, openCase, openSection, outline, outlineRow, selectComponent, toasts } from '../support/editor.ts';
import { describe, expect, test } from '../support/fixtures.ts';

describe('F6 process tree', () => {
  test('add a component through the Add Component dialog', async ({ app, screen, api, newUser, signIn }) => {
    const user = await newUser('tree-add');
    const { projectId, caseId } = await workedExample(api, user);
    await signIn(user, '/home');
    await openCase(app, screen, projectId, caseId);

    await outline(screen).getByRole('button', 'Add Component').tap();
    const dialog = screen.getByRole('dialog', 'New component');
    await expect(dialog).toBeVisible();
    // Guardrails §4 name this radiogroup "Process tier"; today it is "Component type".
    await dialog.getByRole('radiogroup', /^(Process tier|Component type)$/).getByRole('radio', 'Operation').tap();
    // The form's labels are not tied to their inputs: the placeholder stands in.
    await dialog.getByPlaceholder('e.g. Cathode Coating').fill('40. Inspect and pack');
    await dialog.getByRole('button', 'Create component').tap();

    await expect(dialog).toBeHidden();
    await expect(outlineRow(screen, '40. Inspect and pack')).toBeVisible();
    await expect
      .poll(async () => (await components(api, user, caseId)).find((c) => c.component_name === '40. Inspect and pack')?.parent_component_id ?? null)
      .not.toBeNull();
  });

  test('edit a step’s life-cycle stage and save it', async ({ app, screen, browser, api, newUser, signIn }) => {
    const user = await newUser('tree-edit');
    const { projectId, caseId } = await workedExample(api, user);
    await signIn(user, '/home');
    await openCase(app, screen, projectId, caseId);

    await selectComponent(screen, '20. Weld tab');
    const stage = inspector(screen).getByRole('combobox', /^Which stage of the product.s life/);
    await openSection(screen, 'Life-cycle stage', stage);
    await expect(stage).toHaveValue('production');
    await stage.selectOption({ label: 'Use' });
    await inspector(screen).getByRole('button', 'Save').tap();

    const weldId = (await components(api, user, caseId)).find((c) => c.component_name === '20. Weld tab')!.component_id;
    await expect
      .poll(async () => (await api.as(user.token).get<{ component: { life_cycle_stage?: string } }>(`/api/components/${weldId}`)).component.life_cycle_stage)
      .toBe('use');

    await browser.reload();
    await expect(screen.getByTestId('tree-canvas-viewport')).toBeVisible({ timeout: 60_000 });
    await selectComponent(screen, '20. Weld tab');
    await openSection(screen, 'Life-cycle stage', stage);
    await expect(stage).toHaveValue('use');
  });

  describe('delete', () => {
    /** Adds "Finishing" (subprocess) with "Degrease" (operation) under it. */
    async function withSubtree(api: Api, user: ApiUser, caseId: number) {
      const product = (await components(api, user, caseId)).find((c) => c.parent_component_id == null)!;
      const post = (body: object) => api.as(user.token).post<{ component: { component_id: number } }>(`/api/cases/${caseId}/components`, body);
      const finishing = (await post({ component_name: 'Finishing', component_type: 'subprocess', parent_component_id: product.component_id })).component.component_id;
      await post({ component_name: 'Degrease', component_type: 'operation', parent_component_id: finishing });
      return { productId: product.component_id };
    }

    /** Answers the native confirm() dialogs in order; returns the messages seen. */
    async function answerConfirms(browser: Browser, answers: boolean[]) {
      const seen: string[] = [];
      await browser.onDialog(async (d) => {
        seen.push(d.message);
        if (answers.shift()) await d.accept();
        else await d.dismiss();
      });
      return seen;
    }

    test('delete a step with its subtree', async ({ app, screen, browser, api, newUser, signIn }) => {
      const user = await newUser('tree-del');
      const { projectId, caseId } = await workedExample(api, user);
      await withSubtree(api, user, caseId);
      await signIn(user, '/home');
      await openCase(app, screen, projectId, caseId);

      await selectComponent(screen, 'Finishing');
      const seen = await answerConfirms(browser, [true]);
      await inspector(screen).getByRole('button', 'Delete').tap();

      await expect(toasts(screen).getByText('Deleted "Finishing" and the 1 step under it')).toBeVisible();
      expect(seen[0]).toContain('Delete "Finishing" and the 1 step under it');
      await expect(outlineRow(screen, 'Finishing')).toHaveCount(0);
      await expect(outlineRow(screen, 'Degrease')).toHaveCount(0);
      const names = (await components(api, user, caseId)).map((c) => c.component_name);
      expect(names).not.toContain('Finishing');
      expect(names).not.toContain('Degrease');
    });

    test('delete a step but keep its children (they move up)', async ({ app, screen, browser, api, newUser, signIn }) => {
      const user = await newUser('tree-keep');
      const { projectId, caseId } = await workedExample(api, user);
      const { productId } = await withSubtree(api, user, caseId);
      await signIn(user, '/home');
      await openCase(app, screen, projectId, caseId);

      await selectComponent(screen, 'Finishing');
      // Two native confirms: Cancel on the first means "keep the children", OK on the second confirms it.
      const seen = await answerConfirms(browser, [false, true]);
      await inspector(screen).getByRole('button', 'Delete').tap();

      await expect(toasts(screen).getByText('Deleted "Finishing"; 1 step moved up')).toBeVisible();
      expect(seen[1]).toContain('Keep the 1 step directly under "Finishing"');
      await expect(outlineRow(screen, 'Finishing')).toHaveCount(0);
      await expect(outlineRow(screen, 'Degrease')).toBeVisible();
      const degrease = (await components(api, user, caseId)).find((c) => c.component_name === 'Degrease');
      expect(degrease?.parent_component_id).toBe(productId);
    });

    test('cancelling both questions deletes nothing', async ({ app, screen, browser, api, newUser, signIn }) => {
      const user = await newUser('tree-cancel');
      const { projectId, caseId } = await workedExample(api, user);
      await withSubtree(api, user, caseId);
      await signIn(user, '/home');
      await openCase(app, screen, projectId, caseId);

      await selectComponent(screen, 'Finishing');
      const seen = await answerConfirms(browser, [false, false]);
      await inspector(screen).getByRole('button', 'Delete').tap();

      await expect.poll(() => seen.length).toBe(2);
      await expect(outlineRow(screen, 'Finishing')).toBeVisible();
      await expect(outlineRow(screen, 'Degrease')).toBeVisible();
      expect((await components(api, user, caseId)).map((c) => c.component_name)).toEqual(expect.arrayContaining(['Finishing', 'Degrease']));
    });
  });
});

describe('F7 environmental flows', () => {
  test('add a flow, and a transport leg worked out from mass × distance', async ({ app, screen, api, newUser, signIn }) => {
    const user = await newUser('flows');
    const { projectId, caseId } = await workedExample(api, user);
    await signIn(user, '/home');
    await openCase(app, screen, projectId, caseId);
    await selectComponent(screen, '20. Weld tab');
    const pane = inspector(screen);
    const addFlow = pane.getByRole('button', 'Add flow');
    await openSection(screen, 'Environmental Flows', addFlow);

    // A plain input: 0.5 kg aluminium. The add-flow inputs have no accessible
    // names (labels not tied to them): placeholders stand in.
    await addFlow.tap();
    await pane.getByPlaceholder('Search substances…').fill('Aluminum');
    await pane.getByRole('button', /^Aluminum\b/).first().tap();
    await pane.getByPlaceholder('0.0').fill('0.5');
    await pane.getByPlaceholder('kg').fill('kg');
    await pane.getByRole('button', 'Save flow').tap();
    await expect(toasts(screen).getByText('Flow added')).toBeVisible();
    await expect(pane.getByRole('button', 'Edit quantity of Aluminum')).toBeVisible();

    // A transport leg: 0.85 t over 450 km = 382.5 tkm.
    await pane.getByRole('button', 'Add flow').tap();
    await pane.getByPlaceholder('Search substances…').fill('Transport, truck, regional');
    await pane.getByRole('button', /^Transport, truck, regional\b/).first().tap();
    await expect(pane.getByText('Transport leg — enter mass and distance, we compute tonne-km')).toBeVisible();
    await pane.getByPlaceholder('e.g. 1.2').fill('0.85');
    await pane.getByPlaceholder('e.g. 450').fill('450');
    await expect(pane.getByText('= 382.5 tkm')).toBeVisible();
    await expect(pane.getByPlaceholder('0.0')).toHaveValue('382.5');
    await pane.getByRole('button', 'Save flow').tap();
    await expect(pane.getByRole('button', 'Edit quantity of Transport, truck, regional')).toBeVisible();

    const weldId = (await components(api, user, caseId)).find((c) => c.component_name === '20. Weld tab')!.component_id;
    type Flow = { substance_name?: string; quantity: number | string; unit: string; transport_mass_kg?: number | string | null; transport_distance_km?: number | string | null };
    const flows = (await api.as(user.token).get<{ flows: Flow[] }>(`/api/components/${weldId}/flows`)).flows;
    const aluminum = flows.find((f) => f.substance_name?.startsWith('Aluminum'));
    expect(Number(aluminum?.quantity)).toBe(0.5);
    const leg = flows.find((f) => f.substance_name?.startsWith('Transport, truck, regional'));
    expect(leg).toBeDefined();
    expect(Number(leg!.quantity)).toBe(382.5);
    expect(leg!.unit).toBe('tkm');
    expect(Number(leg!.transport_mass_kg)).toBe(850);
    expect(Number(leg!.transport_distance_km)).toBe(450);
  });
});

describe('F8 costs', () => {
  test('a cost of 0 is stored as 0, and a cleared cost goes back to empty', async ({ app, screen, browser, api, newUser, signIn }) => {
    const user = await newUser('costs');
    const { projectId, caseId } = await workedExample(api, user);
    await signIn(user, '/home');
    await openCase(app, screen, projectId, caseId);
    const cutId = (await components(api, user, caseId)).find((c) => c.component_name === '10. Cut blank')!.component_id;
    const stored = async () =>
      (await api.as(user.token).get<{ component: { labor_cost: unknown; energy_cost: unknown } }>(`/api/components/${cutId}`)).component;

    await selectComponent(screen, '10. Cut blank');
    const labor = inspector(screen).getByRole('textbox', 'Labor cost');
    const energy = inspector(screen).getByRole('textbox', 'Energy cost');
    await openSection(screen, 'Costs', labor);

    await labor.fill('0');
    await energy.fill('12.5');
    await inspector(screen).getByRole('button', 'Save').tap();
    await expect.poll(async () => Number((await stored()).energy_cost)).toBe(12.5);
    expect(Number((await stored()).labor_cost)).toBe(0);

    await browser.reload();
    await expect(screen.getByTestId('tree-canvas-viewport')).toBeVisible({ timeout: 60_000 });
    await selectComponent(screen, '10. Cut blank');
    await openSection(screen, 'Costs', labor);
    await expect(labor).toHaveValue('0');
    await expect(energy).toHaveValue('12.5');

    await energy.clear();
    await inspector(screen).getByRole('button', 'Save').tap();
    await expect.poll(async () => (await stored()).energy_cost).toBeNull();
    expect(Number((await stored()).labor_cost)).toBe(0);

    await browser.reload();
    await expect(screen.getByTestId('tree-canvas-viewport')).toBeVisible({ timeout: 60_000 });
    await selectComponent(screen, '10. Cut blank');
    await openSection(screen, 'Costs', labor);
    await expect(energy).toHaveValue('');
    await expect(labor).toHaveValue('0');
  });
});
