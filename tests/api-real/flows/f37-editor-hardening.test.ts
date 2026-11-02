/**
 * F37. The editor hardening rules at the API (lane 1, 2026-11-01):
 *   A1  a unit sent alone converts the stored amount (2.5 kWh is 2,500 Wh),
 *       never relabels it; units that measure different things are refused;
 *   A2  an own factor is restated per the new unit, so a run's impact stays
 *       the same physical number;
 *   E1  a flow moves to another step of the same case, never out of it;
 *   E2  an own factor on a flow with no climate factor names the category as
 *       "climate";
 *   B1  a cost preview works the number out and stores nothing.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sql, sqlOne } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
let gwId: number;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
  gwId = Number((await sql<{ category_id: number }>(`SELECT category_id FROM impact_categories WHERE category_name = 'Global Warming'`))[0].category_id);
});

const run = async () => {
  const res = await api.post(`/api/cases/${w.P.base.id}/assessments`, {
    token: w.users.editor.token,
    json: { run_name: 'Unit change', calculation_method: 'CML 2001', region_code: 'US' },
  });
  expect(res.status, res.text).toBe(201);
  return res;
};
const gwOf = async (runId: number, flowId: number) =>
  (await snapshotOf(runId)).flow_detail.find((r: any) => r.flow_id === flowId && r.category_name === 'Global Warming');

describe('F37 editor hardening', () => {
  it('A1 a unit alone converts the amount: 0.25 kWh is 250 Wh; kg is refused for electricity and nothing changes', async () => {
    const t = w.users.editor.token;
    const id = await w.fresh.flow(); // 0.25 kWh of electricity
    const put = await api.put(`/api/flows/${id}`, { token: t, json: { unit: 'Wh', expected_quantity: 0.25, expected_unit: 'kWh' } });
    expect(put.status, put.text).toBe(200);
    expect(await sqlOne('SELECT quantity, unit FROM flows WHERE flow_id = ?', [id])).toEqual({ quantity: 250, unit: 'Wh' });

    const refused = await api.put(`/api/flows/${id}`, { token: t, json: { unit: 'kg' } });
    expect(refused.status).toBe(400);
    expect(await sqlOne('SELECT quantity, unit FROM flows WHERE flow_id = ?', [id])).toEqual({ quantity: 250, unit: 'Wh' });
    // An amount sent with the unit is taken as typed, in that unit.
    expect((await api.put(`/api/flows/${id}`, { token: t, json: { quantity: 0.3, unit: 'kWh' } })).status).toBe(200);
    expect(await sqlOne('SELECT quantity, unit FROM flows WHERE flow_id = ?', [id])).toEqual({ quantity: 0.3, unit: 'kWh' });
    await api.delete(`/api/flows/${id}`, { token: t });
  });

  it('A2 an own factor follows a unit change: 0.5 per kWh becomes 500 per MWh, and the run impact is the same', async () => {
    const t = w.users.editor.token;
    const id = await w.fresh.flow(); // 0.25 kWh
    expect((await api.put(`/api/flows/${id}/factor`, { token: t, json: { category_id: gwId, factor_value: 0.5, source: 'Utility bill 2025' } })).status).toBe(200);
    const before = await gwOf((await run()).json.run_id, id);
    expect(before.impact).toBeCloseTo(0.125, 12);

    expect((await api.put(`/api/flows/${id}`, { token: t, json: { unit: 'MWh' } })).status).toBe(200);
    expect(await sqlOne('SELECT quantity, unit FROM flows WHERE flow_id = ?', [id])).toEqual({ quantity: 0.00025, unit: 'MWh' });
    const own = await sqlOne<any>('SELECT factor_value, per_unit FROM flow_factor_overrides WHERE flow_id = ?', [id]);
    expect([Number(own.factor_value), own.per_unit]).toEqual([500, 'MWh']);
    const after = await gwOf((await run()).json.run_id, id);
    expect(after.impact).toBeCloseTo(0.125, 12);
    expect(after.origin).toBe('hand');
    await api.delete(`/api/flows/${id}`, { token: t });
  });

  it('E1 a flow moves to another step of its case; a step of another case is refused', async () => {
    const t = w.users.editor.token;
    const id = await w.fresh.flow();
    const moved = await api.put(`/api/flows/${id}`, { token: t, json: { component_id: w.P.base.op } });
    expect(moved.status, moved.text).toBe(200);
    expect(Number((await sqlOne<any>('SELECT component_id FROM flows WHERE flow_id = ?', [id])).component_id)).toBe(w.P.base.op);
    const out = await api.put(`/api/flows/${id}`, { token: t, json: { component_id: w.Q.component } });
    expect(out.status).toBe(400);
    expect(Number((await sqlOne<any>('SELECT component_id FROM flows WHERE flow_id = ?', [id])).component_id)).toBe(w.P.base.op);
    await api.delete(`/api/flows/${id}`, { token: t });
  });

  it('E2 an own factor names "climate" when the flow has no category to send', async () => {
    const t = w.users.editor.token;
    const id = await w.fresh.flow();
    const put = await api.put(`/api/flows/${id}/factor`, { token: t, json: { category: 'climate', factor_value: 0.4, source: 'Supplier sheet 2024' } });
    expect(put.status, put.text).toBe(200);
    expect(put.json.factors).toEqual([expect.objectContaining({ category_id: gwId, factor_value: 0.4, per_unit: 'kWh', source: 'Supplier sheet 2024' })]);
    await api.delete(`/api/flows/${id}`, { token: t });
  });

  it('B1 a cost preview returns the number and stores nothing', async () => {
    const t = w.users.editor.token;
    const before = await sqlOne<any>('SELECT overhead_cost FROM component WHERE component_id = ?', [w.P.base.task]);
    const res = await api.put(`/api/components/${w.P.base.task}/costs`, { token: t, json: { kind: 'overhead', mode: 'entered', amount: 4.2, preview: true } });
    expect(res.status, res.text).toBe(200);
    expect(res.json.preview).toMatchObject({ kind: 'overhead', amount: 4.2 });
    expect(await sqlOne<any>('SELECT overhead_cost FROM component WHERE component_id = ?', [w.P.base.task])).toEqual(before);
  });
});
