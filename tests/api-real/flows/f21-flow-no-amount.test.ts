/**
 * A flow may have no amount yet (migrate-033): a student names what goes in
 * before they know how much. It is saved with quantity NULL, left out of a
 * run, and the run's data-quality statement names it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sqlOne } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

describe('F21 a flow may have no amount yet', () => {
  it('POST without a quantity, with null or with "" saves a flow with quantity NULL', async () => {
    const t = w.users.editor.token;
    const base = { substance_id: w.substances.steel, flow_type: 'input', unit: 'kg' };
    for (const json of [{ ...base }, { ...base, quantity: null }, { ...base, quantity: '' }]) {
      const res = await api.post(`/api/components/${w.P.base.task}/flows`, { token: t, json });
      expect(res.status, `${JSON.stringify(json)} ${res.text}`).toBe(201);
      const row = await sqlOne('SELECT quantity FROM flows WHERE flow_id = ?', [res.json.flow.flow_id]);
      expect(row.quantity).toBeNull();
      await api.delete(`/api/flows/${res.json.flow.flow_id}`, { token: t });
    }
  });

  it('PUT quantity null clears an amount; another field leaves it alone; a number sets it again', async () => {
    const t = w.users.editor.token;
    const add = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: t,
      json: { substance_id: w.substances.steel, flow_type: 'input', quantity: 2, unit: 'kg' },
    });
    const id = Number(add.json.flow.flow_id);
    expect((await api.put(`/api/flows/${id}`, { token: t, json: { quantity: null } })).status).toBe(200);
    expect((await sqlOne('SELECT quantity FROM flows WHERE flow_id = ?', [id])).quantity).toBeNull();
    expect((await api.put(`/api/flows/${id}`, { token: t, json: { unit: 'g' } })).status).toBe(200);
    expect((await sqlOne('SELECT quantity, unit FROM flows WHERE flow_id = ?', [id]))).toEqual({ quantity: null, unit: 'g' });
    expect((await api.put(`/api/flows/${id}`, { token: t, json: { quantity: 350 } })).status).toBe(200);
    expect((await sqlOne('SELECT quantity FROM flows WHERE flow_id = ?', [id])).quantity).toBe(350);
    await api.delete(`/api/flows/${id}`, { token: t });
  });

  it('a viewer still cannot add a flow without an amount (403)', async () => {
    const res = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: w.users.viewer.token,
      json: { substance_id: w.substances.steel, flow_type: 'input', unit: 'kg' },
    });
    expect(res.status).toBe(403);
  });

  it('a run leaves the flow out, keeps the totals, and names it in the data-quality statement', async () => {
    const t = w.users.editor.token;
    const before = await api.post(`/api/cases/${w.P.base.id}/assessments`, {
      token: t,
      json: { run_name: 'Before', calculation_method: 'CML 2001', region_code: 'US' },
    });
    expect(before.status, before.text).toBe(201);
    const add = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: t,
      json: { substance_id: w.substances.steel, flow_type: 'input', unit: 'kg' },
    });
    expect(add.status).toBe(201);
    const after = await api.post(`/api/cases/${w.P.base.id}/assessments`, {
      token: t,
      json: { run_name: 'After', calculation_method: 'CML 2001', region_code: 'US' },
    });
    expect(after.status, after.text).toBe(201);
    const gwp = (r: any) => r.json.total_impacts.find((x: any) => x.category_name === 'Global Warming').impact_value;
    expect(gwp(after)).toBeCloseTo(gwp(before), 9);
    expect(after.json.data_quality.missing_amount_flows).toBe(1);
    expect(after.json.data_quality.statement.join(' ')).toMatch(/1 flow has no amount yet and is left out of this run: Steel/);
    const snap = await snapshotOf(after.json.run_id);
    const row = snap.inventory.find((f: any) => f.flow_id === Number(add.json.flow.flow_id));
    expect(row).toMatchObject({ substance: 'Steel', amount: null });
    await api.delete(`/api/flows/${add.json.flow.flow_id}`, { token: t });
  });
});
