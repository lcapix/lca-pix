/**
 * F7. Environmental flows: add, unit guard, transport tonne-km leg, edit,
 * swap, delete, custom substance, process library.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { buildWorld, substanceId, type World } from '../support/world';

let w: World;
let truck: number;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
  truck = await substanceId('Transport, truck, regional');
});

describe('F7 environmental flows', () => {
  it('F7.1-F7.2 adds a flow exactly as entered and lists it with the substance name', async () => {
    const t = w.users.editor.token;
    const res = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: t,
      json: { substance_id: w.substances.electricity, flow_type: 'input', quantity: '0.35', unit: 'kWh' },
    });
    expect(res.status, res.text).toBe(201);
    expect(res.json.flow).toMatchObject({ flow_type: 'input', unit: 'kWh', substance_name: 'Electricity', is_driver: 1 });
    expect(Number(res.json.flow.quantity)).toBe(0.35);

    const list = await api.get(`/api/components/${w.P.base.task}/flows`, { token: w.users.viewer.token });
    expect(list.status).toBe(200);
    expect(list.json.flows.map((f: any) => f.substance_name)).toEqual(expect.arrayContaining(['Electricity']));
  });

  it('keeps full precision for tiny quantities (flows.quantity is DOUBLE)', async () => {
    const res = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: w.users.editor.token,
      json: { substance_id: w.substances.electricity, flow_type: 'output', quantity: 4e-7, unit: 'kWh' },
    });
    expect(res.status).toBe(201);
    expect((await sqlOne('SELECT quantity FROM flows WHERE flow_id = ?', [res.json.flow.flow_id])).quantity).toBe(4e-7);
  });

  it('F7.3 stores a transport leg: 0.85 t x 450 km = 382.5 tkm, with mass and distance', async () => {
    const res = await api.post(`/api/components/${w.P.base.op}/flows`, {
      token: w.users.editor.token,
      json: { substance_id: truck, flow_type: 'input', quantity: 382.5, unit: 'tkm', transport_mass_kg: 850, transport_distance_km: 450, transport_mode: 'truck' },
    });
    expect(res.status, res.text).toBe(201);
    const row = await sqlOne('SELECT quantity, unit, transport_mass_kg, transport_distance_km, transport_mode FROM flows WHERE flow_id = ?', [res.json.flow.flow_id]);
    expect(row).toEqual({ quantity: 382.5, unit: 'tkm', transport_mass_kg: 850, transport_distance_km: '450.000', transport_mode: 'truck' });

    // Editing the quantity away from mass x distance drops the stale leg (TKM-1/2).
    const put = await api.put(`/api/flows/${res.json.flow.flow_id}`, { token: w.users.editor.token, json: { quantity: 100 } });
    expect(put.status).toBe(200);
    const after = await sqlOne('SELECT quantity, transport_mass_kg, transport_distance_km FROM flows WHERE flow_id = ?', [res.json.flow.flow_id]);
    expect(after).toEqual({ quantity: 100, transport_mass_kg: null, transport_distance_km: null });
  });

  it('F7.4 the unit guard: a unit that will not convert gets 400 naming compatible units', async () => {
    const res = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: w.users.editor.token,
      json: { substance_id: w.substances.steel, flow_type: 'input', quantity: 1, unit: 'kWh' },
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/^Unit 'kWh' cannot be converted to 'kg', the unit Steel's impact factors are stored in\. Compatible units: .*\bg\b/);
    // A compatible unit is kept as entered.
    const ok = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: w.users.editor.token,
      json: { substance_id: w.substances.steel, flow_type: 'input', quantity: 350, unit: 'g' },
    });
    expect(ok.status).toBe(201);
    expect(ok.json.flow.unit).toBe('g');
  });

  it('quantity null, "abc", NaN, negative or boolean -> 400 (FLOW-4 fixed); missing fields -> 400', async () => {
    const t = w.users.editor.token;
    const base = { substance_id: w.substances.electricity, flow_type: 'input', unit: 'kWh' };
    for (const raw of ['null', '"abc"', '-1', 'true', '"NaN"', '1e309']) {
      const r = await api.post(`/api/components/${w.P.base.task}/flows`, {
        token: t,
        raw: `{"substance_id":${base.substance_id},"flow_type":"input","unit":"kWh","quantity":${raw}}`,
      });
      expect(r.status, raw).toBe(400);
    }
    for (const json of [{ ...base }, { quantity: 1, flow_type: 'input', unit: 'kWh' }, { ...base, quantity: 1, flow_type: 'sideways' }, { ...base, quantity: 1, unit: '' }]) {
      const r = await api.post(`/api/components/${w.P.base.task}/flows`, { token: t, json });
      expect(r.status, JSON.stringify(json)).toBe(400);
    }
  });

  it('F7.5-F7.6 edits the quantity, swaps the substance, deletes the flow', async () => {
    const t = w.users.editor.token;
    const id = Number(
      (await api.post(`/api/components/${w.P.base.task}/flows`, { token: t, json: { substance_id: w.substances.electricity, flow_type: 'input', quantity: 1, unit: 'kWh' } })).json.flow.flow_id,
    );
    const q = await api.put(`/api/flows/${id}`, { token: t, json: { quantity: 2.75 } });
    expect(q.status).toBe(200);
    expect(Number(q.json.flow.quantity)).toBe(2.75);
    // Swapping to a substance whose unit the flow's unit cannot convert to is refused.
    const badSwap = await api.put(`/api/flows/${id}`, { token: t, json: { substance_id: w.substances.steel } });
    expect(badSwap.status).toBe(400);
    const swap = await api.put(`/api/flows/${id}`, { token: t, json: { substance_id: w.substances.steel, unit: 'kg' } });
    expect(swap.status).toBe(200);
    expect(swap.json.flow).toMatchObject({ substance_name: 'Steel', unit: 'kg' });
    for (const json of [{ quantity: null }, { quantity: -2 }, { flow_type: 'both' }]) {
      expect((await api.put(`/api/flows/${id}`, { token: t, json })).status, JSON.stringify(json)).toBe(400);
    }
    const del = await api.delete(`/api/flows/${id}`, { token: t });
    expect(del.status).toBe(200);
    expect(await sql('SELECT flow_id FROM flows WHERE flow_id = ?', [id])).toEqual([]);
    expect((await api.delete(`/api/flows/${id}`, { token: t })).status).toBe(404);
  });

  it('F7.7 a custom substance is usable by its author in a flow, and nobody else', async () => {
    const t = w.users.owner.token;
    const created = await api.post('/api/substances', {
      token: t,
      json: { name: `Kiln wash ${w.tag}`, kind: 'input', unit: 'kg', method: 'CML 2001', impactCategory: 'Global Warming', factorValue: 1.7, source: 'Supplier EPD 2025' },
    });
    expect(created.status).toBe(201);
    const sid = Number(created.json.substance.substance_id);
    expect(created.json.substance).toMatchObject({ is_custom: 1, created_by: w.users.owner.id });
    const flow = await api.post(`/api/components/${w.P.base.task}/flows`, { token: t, json: { substance_id: sid, flow_type: 'input', quantity: 0.01, unit: 'kg' } });
    expect(flow.status).toBe(201);
    // An editor of the same project is another user: the owner's private substance is not theirs to use.
    const editor = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: w.users.editor.token,
      json: { substance_id: sid, flow_type: 'input', quantity: 0.01, unit: 'kg' },
    });
    expect(editor.status).toBe(400);
    expect(editor.text).not.toContain('Kiln wash');
  });

  it('F7.8 the process library lists templates with their lines', async () => {
    const res = await api.get('/api/process-templates', { token: w.users.editor.token });
    expect(res.status).toBe(200);
    expect(res.json.templates.length).toBeGreaterThan(5);
    const withLines = res.json.templates.find((t: any) => t.lines.length > 0);
    expect(withLines).toBeTruthy();
    expect(withLines.lines[0]).toHaveProperty('unit');
  });
});
