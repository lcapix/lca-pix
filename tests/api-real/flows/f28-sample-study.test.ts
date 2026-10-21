/**
 * F28. The sample study (education 2.9, E02 / E03 / E04 / E14 / F1.4), built by
 * POST /api/example-project on a fresh database: its shape, its golden totals
 * (1.72 and 1.667 kg CO2-eq per bracket, TRACI 2.1 / US), its costs ($1.75),
 * that it is read-only, and that "Make my own copy" keeps every amount.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sql, sqlOne } from '../support/db';
import { createUser, type TestUser } from '../support/users';

let u: TestUser;
let built: any;
beforeAll(async () => {
  u = await createUser('f28sample');
  const res = await api.post('/api/example-project', { token: u.token });
  expect(res.status, res.text).toBe(200);
  built = res.json;
});

const gw = (snap: any) => snap.totals.find((t: any) => t.category_name === 'Global Warming');

describe('F28 sample study', () => {
  it('a sample project with a read-only base case and a read-only what-if copied from it', async () => {
    expect(built).toMatchObject({ existed: false, project_id: expect.any(Number), case_id: expect.any(Number), what_if_case_id: expect.any(Number) });
    const cases = await sql<any>(
      'SELECT case_id, case_name, case_type, read_only, parent_case_id, created_by FROM case_table WHERE project_id = ? ORDER BY case_id',
      [built.project_id],
    );
    expect(cases).toEqual([
      { case_id: built.case_id, case_name: 'Base case', case_type: 'base', read_only: 1, parent_case_id: null, created_by: u.id },
      { case_id: built.what_if_case_id, case_name: 'Shorter cure cycle', case_type: 'comparative', read_only: 1, parent_case_id: built.case_id, created_by: u.id },
    ]);
    expect(await sqlOne('SELECT is_sample, system_boundary, boundary_notes FROM project WHERE project_id = ?', [built.project_id])).toEqual({
      is_sample: 1,
      system_boundary: 'cradle-to-gate',
      boundary_notes: 'Cradle to gate, plus packing.',
    });
  });

  it('17 steps in five tiers and nine flows, the tape recorded as 1 roll and the deburr from the calculator', async () => {
    const tiers = await sql<any>(
      'SELECT component_type, COUNT(*) AS n FROM component WHERE case_id = ? GROUP BY component_type ORDER BY MIN(hierarchy_level)',
      [built.case_id],
    );
    expect(tiers.map((t: any) => [t.component_type, Number(t.n)])).toEqual([
      ['product', 1], ['machine_line', 3], ['subprocess', 4], ['operation', 4], ['elemental_task', 5],
    ]);
    const flows = await sql<any>(
      `SELECT c.component_name AS step, s.substance_name AS substance, f.flow_type, f.quantity, f.unit
         FROM flows f JOIN component c ON c.component_id = f.component_id JOIN substances s ON s.substance_id = f.substance_id
        WHERE c.case_id = ? ORDER BY f.flow_id`,
      [built.case_id],
    );
    expect(flows).toHaveLength(9);
    expect(flows).toEqual(expect.arrayContaining([
      { step: '10. Cut blank', substance: 'Steel', flow_type: 'input', quantity: 0.8, unit: 'kg' },
      { step: 'Deburr edges', substance: 'Electricity', flow_type: 'input', quantity: 0.0013, unit: 'kWh' },
      { step: 'Fold and tape', substance: 'Packaging tape', flow_type: 'input', quantity: 1, unit: 'roll' },
      { step: '40. Pack and ship', substance: 'Scrap steel', flow_type: 'output', quantity: 0.12, unit: 'kg' },
    ]));
  });

  it('golden totals: the base case run is 1.72 and the what-if 1.667 (3.1% lower)', async () => {
    const base = await snapshotOf(built.run_id);
    const whatIf = await snapshotOf(built.what_if_run_id);
    expect(base.method).toBe('TRACI 2.1');
    expect(base.region).toBe('US');
    const b = gw(base).value;
    const w = gw(whatIf).value;
    expect(b.toFixed(2)).toBe('1.72');
    expect(w.toFixed(3)).toBe('1.667');
    expect(b - w).toBeCloseTo(0.0525, 9);
    expect((((b - w) / b) * 100).toFixed(1)).toBe('3.1');
    // What builds it: 10. Cut blank with its deburr task 1.538 (89.4%), 30. 0.140, 20. 0.042.
    const step = (name: string) => base.steps.find((s: any) => s.name === name);
    const gwOf = (s: any) => s?.impacts.find((i: any) => i.category_name === 'Global Warming')?.value ?? 0;
    const cut = gwOf(step('10. Cut blank')) + gwOf(step('Deburr edges')) + gwOf(step('Shear blank'));
    expect(cut.toFixed(3)).toBe('1.538');
    expect(((cut / b) * 100).toFixed(1)).toBe('89.4');
    expect(gwOf(step('30. Powder coat and cure')).toFixed(3)).toBe('0.140');
    expect(gwOf(step('20. Weld tab')).toFixed(3)).toBe('0.042');
    // Steel 0.80 x 1.900 = 1.520 on the worldsteel global average: 88.4% of the result.
    const steel = base.flow_detail.find((r: any) => r.substance === 'Steel' && r.category_name === 'Global Warming');
    expect(steel).toMatchObject({ amount: 0.8, factor: 1.9, scope: 'Global' });
    expect(((steel.impact / b) * 100).toFixed(1)).toBe('88.4');
    // The materials without a climate factor are named, not silently dropped.
    const statement = base.data_quality.statement.join(' ');
    for (const name of ['Argon', 'Powder coating', 'Packaging tape', 'Scrap steel']) expect(statement).toContain(name);
  });

  it('costs: $1.75 per bracket, Weld tab $0.55 = 0.39 + 0.01 + 0.03 + 0.12, each with its rate and source', async () => {
    const [total] = await sql<any>(
      `SELECT SUM(COALESCE(labor_cost,0) + COALESCE(energy_cost,0) + COALESCE(material_cost,0) + COALESCE(transportation_cost,0)
                + COALESCE(equipment_cost,0) + COALESCE(overhead_cost,0)) AS t FROM component WHERE case_id = ?`,
      [built.case_id],
    );
    expect(Number(total.t)).toBeCloseTo(1.75, 9);
    const weld = await sqlOne<any>(`SELECT component_id FROM component WHERE case_id = ? AND component_name = '20. Weld tab'`, [built.case_id]);
    const costs = await api.get(`/api/components/${weld.component_id}/costs`, { token: u.token });
    expect(costs.status).toBe(200);
    expect(costs.json.set).toBe(4);
    const by = Object.fromEntries(costs.json.costs.map((c: any) => [c.kind, c]));
    expect([by.labor.amount, by.energy.amount, by.material.amount, by.overhead.amount]).toEqual([0.39, 0.01, 0.03, 0.12]);
    expect(by.labor.basis).toMatchObject({ driver_quantity: 0.015, rate: 25.83, rate_label: 'Welders/cutters', rate_code: '51-4121', source_kind: 'reference', vintage: '2026-06' });
    expect(by.overhead.basis).toMatchObject({ source_kind: 'entered', driver_quantity: null });
    // The run froze them.
    const snap = await snapshotOf(built.run_id);
    expect(snap.steps.find((s: any) => s.name === '20. Weld tab').cost_basis.map((c: any) => c.kind)).toEqual(['labor', 'energy', 'material', 'overhead']);
  });

  it('nobody changes the sample, its owner included; "Make my own copy" keeps every amount and is editable', async () => {
    const put = await api.put(`/api/cases/${built.case_id}`, { token: u.token, json: { interpretation: 'mine' } });
    expect(put.status).toBe(403);
    const rerun = await api.post(`/api/cases/${built.what_if_case_id}/assessments`, { token: u.token, json: {} });
    expect(rerun.status).toBe(403);

    const copy = await api.post(`/api/cases/${built.case_id}/duplicate`, { token: u.token, json: { case_name: "Elena Rivera's case" } });
    expect(copy.status, copy.text).toBe(201);
    const copyId = Number(copy.json.case_id);
    const q = (caseId: number) =>
      sql<any>(
        `SELECT c.component_name, s.substance_name, f.quantity, f.unit FROM flows f
           JOIN component c ON c.component_id = f.component_id JOIN substances s ON s.substance_id = f.substance_id
          WHERE c.case_id = ? ORDER BY c.component_name, s.substance_name`,
        [caseId],
      );
    expect(await q(copyId)).toEqual(await q(built.case_id));
    expect(await sqlOne('SELECT read_only, parent_case_id FROM case_table WHERE case_id = ?', [copyId])).toEqual({ read_only: 0, parent_case_id: built.case_id });
    const [copiedBasis] = await sql<any>(
      'SELECT COUNT(*) AS n FROM component_cost_basis b JOIN component c ON c.component_id = b.component_id WHERE c.case_id = ?',
      [copyId],
    );
    expect(Number(copiedBasis.n)).toBe(12);
    // The copy is the student's to run: no runs until they run it, and the run matches the base.
    expect(await sql('SELECT run_id FROM assessment_runs WHERE case_id = ?', [copyId])).toEqual([]);
    const run = await api.post(`/api/cases/${copyId}/assessments`, { token: u.token, json: {} });
    expect(run.status, run.text).toBe(201);
    expect(run.json.total_impacts.find((t: any) => t.category_name === 'Global Warming').impact_value.toFixed(2)).toBe('1.72');
  });

  it('one sample per account, even for two requests at once', async () => {
    const v = await createUser('f28race');
    const [a, b] = await Promise.all([
      api.post('/api/example-project', { token: v.token }),
      api.post('/api/example-project', { token: v.token }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.json.project_id).toBe(b.json.project_id);
    expect([a.json.existed, b.json.existed].sort()).toEqual([false, true]);
    expect((await sql('SELECT COUNT(*) AS n FROM project WHERE owner_id = ? AND is_sample = 1', [v.id]))[0].n).toBe(1);
  });
});
