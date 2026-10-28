/**
 * Kept rows of the case editor. E15, E17 and E18 are exercised by the
 * journeys, so their ids sit on those titles instead of a second check.
 */
import { workedExample, openCase } from '../support/editor';
import { expect, test } from '../support/fixtures';
import { note, row } from '../support/parity';

const step = (page: import('@playwright/test').Page, name: string) =>
  page.getByRole('treeitem', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });

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
