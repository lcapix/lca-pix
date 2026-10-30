/**
 * F36. TRACI 2.1's cancer and particulate matter categories (migrate-044):
 * the engine computes each as amount x factor, and a material keeps its
 * climate factor only (K01, K02, K03).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sqlOne } from '../support/db';
import { addFlow, buildWorld, createCase, createComponent, createProject, type World } from '../support/world';
import { climateOnlyFlows } from '@/lib/results/full-results-view';

let w: World;
let caseId: number;
const ids: Record<string, number> = {};

async function substance(name: string) {
  const r = await sqlOne<{ substance_id: number }>(
    `SELECT s.substance_id FROM substances s WHERE s.substance_name = ? ORDER BY s.substance_id LIMIT 1`,
    [name],
  );
  return Number(r!.substance_id);
}

async function factor(name: string, category: string) {
  const r = await sqlOne<{ factor_value: string }>(
    `SELECT d.factor_value FROM driver_impact_factors d
       JOIN substances s ON s.substance_id = d.substance_id
       JOIN impact_categories ic ON ic.category_id = d.category_id
      WHERE s.substance_name = ? AND ic.category_name = ? AND d.method_name = 'TRACI 2.1' AND d.geographic_scope = 'Global'
      ORDER BY s.substance_id LIMIT 1`,
    [name, category],
  );
  return Number(r!.factor_value);
}

beforeAll(async () => {
  w = await buildWorld({ runs: false });
  const owner = w.users.owner;
  const projectId = await createProject(owner, `TRACI health ${w.tag}`, { lcia_method: 'TRACI 2.1', region_code: 'Global' });
  caseId = await createCase(owner, projectId, `Coated part ${w.tag}`);
  const step = await createComponent(owner, caseId, { component_name: `Coating ${w.tag}`, component_type: 'operation', parent_component_id: null, quantity: 1, unit: 'unit' });
  ids.benzene = await addFlow(owner, step, { substance_id: await substance('Benzene'), flow_type: 'output', quantity: 2, unit: 'kg' });
  ids.ammonia = await addFlow(owner, step, { substance_id: await substance('Ammonia'), flow_type: 'output', quantity: 3, unit: 'kg' });
  ids.steel = await addFlow(owner, step, { substance_id: await substance('Steel'), flow_type: 'input', quantity: 5, unit: 'kg' });
});

describe('F36 TRACI cancer and particulate matter', () => {
  it('K01 K02 K03 a run counts each as amount x factor; steel is climate only', async () => {
    const res = await api.post(`/api/cases/${caseId}/assessments`, {
      token: w.users.owner.token,
      json: { calculation_method: 'TRACI 2.1', region_code: 'Global' },
    });
    expect(res.status, res.text).toBe(201);
    const total = (name: string) => res.json.total_impacts.find((t: any) => t.category_name === name);

    // K01: Benzene to air. The parquet row is TRACI_2.1_v1.0.0_5555779.parquet row 160469
    // (Indicator "Human health - cancer", Flowable "Benzene", Context "emission/air",
    // 2.970256e-07 CTUcancer per kg); NUMERIC(20,10) keeps it as 2.970e-07.
    const cancer = await factor('Benzene', 'Human Health - Cancer');
    expect(cancer).toBeCloseTo(2.970256e-7, 9);
    expect(total('Human Health - Cancer').unit).toBe('CTUcancer');
    expect(total('Human Health - Cancer').impact_value).toBeCloseTo(2 * cancer, 15);

    // K02: Ammonia to air, parquet row 280 ("emission/air", 0.066667 PM 2.5 eq per kg).
    const pm = await factor('Ammonia', 'Particulate Matter');
    expect(pm).toBeCloseTo(0.0666666667, 9);
    expect(total('Particulate Matter').impact_value).toBeCloseTo(3 * pm, 9);

    // K03: steel carries its climate factor and nothing else, so every other category reads "climate only".
    const snap = await snapshotOf(res.json.run_id);
    const steelRows = snap.flow_detail.filter((r: any) => r.flow_id === ids.steel);
    expect(steelRows.map((r: any) => r.category_name)).toEqual(['Global Warming']);
    const rows = snap.flow_detail.map((r: any) => ({ ...r, dir: r.dir ?? (r.flow_type === 'input' ? 'IN' : 'OUT') }));
    expect(climateOnlyFlows(rows).map((r: any) => r.flow_id)).toEqual([ids.steel]);
  });

  it('K01 K02 the method lists both categories', async () => {
    const list = await api.get(`/api/cases/${caseId}/assessments`, { token: w.users.owner.token });
    expect(list.status).toBe(200);
    const cats = list.json.assessments[0].method_categories as string[];
    expect(cats).toEqual(expect.arrayContaining(['Human Health - Cancer', 'Particulate Matter']));
  });
});
