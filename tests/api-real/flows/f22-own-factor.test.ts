/**
 * F22. A person's own factor for one flow (migrate-034, E03 "Use my own
 * number"): who may set it, what is refused, how a run uses it, and that a
 * copy of the case keeps it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sql } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
let gwId: number;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
  gwId = Number((await sql<{ category_id: number }>(`SELECT category_id FROM impact_categories WHERE category_name = 'Global Warming'`))[0].category_id);
});

const url = () => `/api/flows/${w.P.base.flow}/factor`;
const electricityRows = (snap: any) =>
  snap.flow_detail.filter((r: any) => r.substance === 'Electricity' && r.category_name === 'Global Warming');
const runBase = async () => {
  const res = await api.post(`/api/cases/${w.P.base.id}/assessments`, {
    token: w.users.editor.token,
    json: { run_name: 'Own factor', calculation_method: 'CML 2001', region_code: 'US' },
  });
  expect(res.status, res.text).toBe(201);
  return res;
};

describe('F22 own factor for a flow', () => {
  it('access: a viewer reads but cannot set (403); a non-member gets 404; anonymous 401', async () => {
    const body = { category_id: gwId, factor_value: 0.5, source: 'Utility bill 2025' };
    expect((await api.get(url(), { token: w.users.viewer.token })).status).toBe(200);
    expect((await api.put(url(), { token: w.users.viewer.token, json: body })).status).toBe(403);
    expect((await api.put(url(), { token: w.users.nonmem.token, json: body })).status).toBe(404);
    expect((await api.put(url(), { token: w.users.userB.token, json: body })).status).toBe(404);
    expect((await api.put(url(), { json: body })).status).toBe(401);
    expect((await api.put(`/api/flows/999999999/factor`, { token: w.users.editor.token, json: body })).status).toBe(404);
  });

  it('refuses a missing source, a word for a number, an unknown category, a unit the flow cannot use, extra keys', async () => {
    const t = w.users.editor.token;
    for (const json of [
      { category_id: gwId, factor_value: 0.5 },
      { category_id: gwId, factor_value: 'half', source: 'x' },
      { category_id: 99999, factor_value: 0.5, source: 'x' },
      { category_id: gwId, factor_value: 0.5, source: 'x', per_unit: 'kg' },
      { category_id: gwId, factor_value: 0.5, source: 'x', impact_unit: 'kg N eq' },
    ]) {
      const res = await api.put(url(), { token: t, json });
      expect(res.status, JSON.stringify(json)).toBe(400);
      expect(res.json.error).not.toMatch(/\bER_[A-Z_]+|sqlMessage|\bat .+:\d+/);
    }
    expect((await api.get(url(), { token: t })).json.factors).toEqual([]);
  });

  it("a run uses the number: 2.5 kWh × 0.5 = 1.25, tagged Entered by hand with its source; removing it restores the library", async () => {
    const before = electricityRows(await snapshotOf((await runBase()).json.run_id));
    expect(before).toHaveLength(1);
    expect(before[0].origin).toBeUndefined();

    const t = w.users.editor.token;
    const put = await api.put(url(), {
      token: t,
      json: { category_id: gwId, factor_value: 0.5, source: 'Utility bill 2025', note: 'campus solar share' },
    });
    expect(put.status, put.text).toBe(200);
    expect(put.json.factors).toEqual([
      expect.objectContaining({ category_id: gwId, factor_value: 0.5, impact_unit: 'kg CO2 eq', per_unit: 'kWh', source: 'Utility bill 2025' }),
    ]);
    // The step's flow list carries it, so the editor can tag the flow.
    const list = await api.get(`/api/components/${w.P.base.task}/flows`, { token: w.users.viewer.token });
    expect(list.json.flows.find((f: any) => f.flow_id === w.P.base.flow).own_factors).toHaveLength(1);
    // Setting it again replaces it (one per flow and category).
    expect((await api.put(url(), { token: t, json: { category_id: gwId, factor_value: 0.5, source: 'Utility bill 2025' } })).status).toBe(200);
    expect((await sql('SELECT COUNT(*) AS n FROM flow_factor_overrides WHERE flow_id = ?', [w.P.base.flow]))[0]).toEqual({ n: 1 });

    const run = await runBase();
    const rows = electricityRows(await snapshotOf(run.json.run_id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ factor: 0.5, scope: 'Entered by hand', origin: 'hand', source: 'Entered by hand: Utility bill 2025' });
    expect(rows[0].impact).toBeCloseTo(1.25, 12);
    expect(run.json.data_quality.hand_entered).toBe(1);
    expect(run.json.data_quality.statement.join(' ')).toContain('1 factor was entered by hand, not taken from the library: Electricity (Global Warming).');

    // A copy of the case keeps the number on its own flow.
    const dup = await api.post(`/api/cases/${w.P.base.id}/duplicate`, { token: t, json: { case_name: `Own factor copy ${w.tag}` } });
    expect(dup.status, dup.text).toBe(201);
    const copied = await sql<any>(
      `SELECT o.factor_value, o.source, o.flow_id FROM flow_factor_overrides o
         JOIN flows f ON f.flow_id = o.flow_id JOIN component c ON c.component_id = f.component_id
        WHERE c.case_id = ?`,
      [dup.json.case_id],
    );
    expect(copied).toHaveLength(1);
    expect(copied[0]).toMatchObject({ factor_value: 0.5, source: 'Utility bill 2025' });
    expect(copied[0].flow_id).not.toBe(w.P.base.flow);

    const del = await api.delete(`${url()}?category_id=${gwId}`, { token: t });
    expect(del.status).toBe(200);
    expect(del.json.factors).toEqual([]);
    expect((await api.delete(`${url()}?category_id=abc`, { token: t })).status).toBe(400);
    const after = electricityRows(await snapshotOf((await runBase()).json.run_id));
    expect(after[0].factor).toBe(before[0].factor);
    expect(after[0].origin).toBeUndefined();
  });

  it('deleting the flow deletes its own factor', async () => {
    const t = w.users.editor.token;
    const flowId = await w.fresh.flow();
    expect((await api.put(`/api/flows/${flowId}/factor`, { token: t, json: { category_id: gwId, factor_value: 0.1, source: 'x' } })).status).toBe(200);
    expect((await api.delete(`/api/flows/${flowId}`, { token: t })).status).toBe(200);
    expect(await sql('SELECT override_id FROM flow_factor_overrides WHERE flow_id = ?', [flowId])).toEqual([]);
  });
});
