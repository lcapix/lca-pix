/**
 * F23. A step's costs and how each was built (migrate-035, E14): who may set
 * them, what is refused, that only the server writes "reference" or "live",
 * and that a run, a copy and a scale keep the basis honest.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sql, sqlOne } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
  // No network in tests: the shared rate cache answers. Michigan has a live
  // BLS row; Ohio has a seeded reference row, as the baseline seeds them.
  for (const [region, value, date, source] of [
    ['MI', 23.87, '2025-05-01', 'BLS OEWS 2025'],
    ['OH', 25.83, '2026-06-01', 'BLS OEWS reference 2026-06'],
  ]) {
    await sql(
      `INSERT INTO cost_rates (rate_type, rate_key, region_code, rate_value, rate_unit, effective_date, source, fetched_at)
       VALUES ('labor', '51-4121', ?, ?, '$/hr', ?, ?, NOW())
       ON DUPLICATE KEY UPDATE rate_value = VALUES(rate_value), source = VALUES(source), fetched_at = NOW()`,
      [region, value, date, source],
    );
  }
});

const url = () => `/api/components/${w.P.base.op}/costs`;
const kind = (body: any, k: string) => body.costs.find((c: any) => c.kind === k);
const weld = { kind: 'labor', mode: 'lookup', driver_quantity: 0.015, rate_code: '51-4121', region: 'OH' };

describe('F23 step costs', () => {
  it('access: any member reads the six costs; a viewer cannot set one (403); outsiders 404; anonymous 401', async () => {
    const res = await api.get(url(), { token: w.users.viewer.token });
    expect(res.status, res.text).toBe(200);
    expect(res.json.costs.map((c: any) => c.kind)).toEqual(['labor', 'energy', 'material', 'transportation', 'equipment', 'overhead']);
    expect(res.json.of).toBe(6);
    expect((await api.put(url(), { token: w.users.viewer.token, json: weld })).status).toBe(403);
    expect((await api.put(url(), { token: w.users.nonmem.token, json: weld })).status).toBe(404);
    expect((await api.put(url(), { token: w.users.userB.token, json: weld })).status).toBe(404);
    expect((await api.put(url(), { json: weld })).status).toBe(401);
    expect((await api.get(url(), { token: w.users.userB.token })).status).toBe(404);
  });

  it('refuses a rate sent with a lookup, a bad code or region, energy without a unit, a price no unit fits, half an own rate', async () => {
    const t = w.users.editor.token;
    for (const json of [
      { ...weld, rate: 99 },
      { ...weld, source_kind: 'live' },
      { ...weld, rate_code: 'welder' },
      { ...weld, region: 'Michigan' },
      { ...weld, region: 'ZZ' },
      { kind: 'energy', mode: 'lookup', driver_quantity: 1, rate_code: 'electricity', region: 'US' },
      { kind: 'energy', mode: 'lookup', driver_quantity: 1, rate_code: 'coal', region: 'US', driver_unit: 'kg' },
      { kind: 'energy', mode: 'lookup', driver_quantity: 3, rate_code: 'natural_gas', region: 'US', driver_unit: 'kg' },
      { kind: 'labor', mode: 'entered', rate: 30 },
      { kind: 'labor', mode: 'entered', driver_quantity: 1, rate: 30, amount: 30 },
      { kind: 'labor', mode: 'guess', amount: 1 },
    ]) {
      const res = await api.put(url(), { token: t, json });
      expect(res.status, `${JSON.stringify(json)} ${res.text}`).toBe(400);
      expect(res.json.error).not.toMatch(/\bER_[A-Z_]+|sqlMessage|\bat .+:\d+/);
    }
  });

  it('a labor lookup: the server finds the rate, stores amount, hours, occupation and the basis together', async () => {
    const res = await api.put(url(), { token: w.users.editor.token, json: weld });
    expect(res.status, res.text).toBe(200);
    const labor = kind(res.json, 'labor');
    // Ohio's cached row is the reference: the national welder rate, tagged so.
    expect(labor.basis).toMatchObject({
      driver_quantity: 0.015, driver_unit: 'h', rate: 25.83, rate_unit: '$/h', rate_label: 'Welders/cutters',
      rate_code: '51-4121', region: 'US', source_kind: 'reference', source_name: 'Reference', vintage: '2026-06',
    });
    expect(labor.amount).toBe(0.39); // 0.38745, stored in cents
    expect(await sqlOne('SELECT labor_cost, labor_hours, labor_occupation FROM component WHERE component_id = ?', [w.P.base.op]))
      .toEqual({ labor_cost: '0.39', labor_hours: '0.0150', labor_occupation: '51-4121' });
  });

  it('a live answer is tagged live, with its state and year', async () => {
    const res = await api.put(`/api/components/${w.P.base.task}/costs`, {
      token: w.users.editor.token,
      json: { ...weld, region: 'MI', driver_quantity: 0.5 },
    });
    expect(res.status, res.text).toBe(200);
    expect(kind(res.json, 'labor')).toMatchObject({
      amount: 11.94, // 0.5 x 23.87 = 11.935, stored in cents
      basis: { rate: 23.87, region: 'MI', source_kind: 'live', source_name: 'BLS OEWS 2025', vintage: '2025', rate_label: 'Welders/cutters' },
    });
  });

  it("prefer 'reference' saves the dated rate the list shows, even where a live one is cached", async () => {
    // Michigan has a live row cached; a reference pick must not use it.
    const res = await api.put(`/api/components/${w.P.base.task}/costs`, {
      token: w.users.editor.token,
      json: { ...weld, region: 'MI', driver_quantity: 0.015, prefer: 'reference' },
    });
    expect(res.status, res.text).toBe(200);
    expect(kind(res.json, 'labor')).toMatchObject({
      amount: 0.39,
      basis: { rate: 25.83, region: 'US', source_kind: 'reference', vintage: '2026-06', rate_label: 'Welders/cutters' },
    });
    const energy = await api.put(`/api/components/${w.P.base.task}/costs`, {
      token: w.users.editor.token,
      json: { kind: 'energy', mode: 'lookup', driver_quantity: 0.12, rate_code: 'electricity', region: 'US', driver_unit: 'kWh', prefer: 'reference' },
    });
    expect(energy.status, energy.text).toBe(200);
    expect(kind(energy.json, 'energy').basis).toMatchObject({ rate: 0.0862, source_kind: 'reference', driver_unit: 'kWh' });
    // Anything else in 'prefer' is refused.
    const bad = await api.put(url(), { token: w.users.editor.token, json: { ...weld, prefer: 'live' } });
    expect(bad.status).toBe(400);
  });

  it("own rates: energy as driver x rate, overhead as an amount alone, both tagged entered; 'N of 6 set' counts them", async () => {
    const t = w.users.editor.token;
    const before = (await api.get(url(), { token: t })).json.set;
    const energy = await api.put(url(), {
      token: t,
      json: { kind: 'energy', mode: 'entered', driver_quantity: 0.12, driver_unit: 'kWh', rate: 0.09, rate_unit: '$/kWh', rate_label: 'Campus tariff' },
    });
    expect(energy.status, energy.text).toBe(200);
    expect(kind(energy.json, 'energy')).toMatchObject({
      amount: 0.01, basis: { driver_quantity: 0.12, rate: 0.09, source_kind: 'entered', rate_label: 'Campus tariff' },
    });
    const overhead = await api.put(url(), { token: t, json: { kind: 'overhead', mode: 'entered', amount: 0.12, source_name: 'Shop overhead 2025' } });
    expect(kind(overhead.json, 'overhead')).toMatchObject({ amount: 0.12, basis: { driver_quantity: null, rate: null, source_kind: 'entered', source_name: 'Shop overhead 2025' } });
    expect(overhead.json.set).toBeGreaterThanOrEqual(before);
  });

  it('a direct edit that changes a cost drops its basis; resending the same value keeps it', async () => {
    const t = w.users.editor.token;
    const now = await sqlOne<any>('SELECT labor_cost, material_cost FROM component WHERE component_id = ?', [w.P.base.op]);
    expect((await api.put(`/api/components/${w.P.base.op}`, { token: t, json: { labor_cost: now.labor_cost } })).status).toBe(200);
    expect(kind((await api.get(url(), { token: t })).json, 'labor').basis).not.toBeNull();
    expect((await api.put(`/api/components/${w.P.base.op}`, { token: t, json: { overhead_cost: 0.2 } })).status).toBe(200);
    const after = (await api.get(url(), { token: t })).json;
    expect(kind(after, 'overhead')).toMatchObject({ amount: 0.2, basis: null });
    expect(kind(after, 'labor').basis).not.toBeNull();
  });

  it('a run freezes each step cost with its basis; a copy keeps the basis; scaling doubles the driver', async () => {
    const t = w.users.editor.token;
    const run = await api.post(`/api/cases/${w.P.base.id}/assessments`, {
      token: t,
      json: { run_name: 'Costs', calculation_method: 'CML 2001', region_code: 'US' },
    });
    expect(run.status, run.text).toBe(201);
    const snap = await snapshotOf(run.json.run_id);
    const step = snap.steps.find((s: any) => s.component_id === w.P.base.op);
    expect(step.cost_basis.map((b: any) => `${b.kind} ${b.source_kind}`)).toEqual(['labor reference', 'energy entered']);
    expect(step.cost_basis[0]).toMatchObject({ amount: 0.39, rate: 25.83, vintage: '2026-06' });

    const dup = await api.post(`/api/cases/${w.P.base.id}/duplicate`, { token: t, json: { case_name: `Costs copy ${w.tag}` } });
    expect(dup.status, dup.text).toBe(201);
    const copied = await sql<any>(
      `SELECT b.cost_kind, b.rate, b.source_kind FROM component_cost_basis b
         JOIN component c ON c.component_id = b.component_id
        WHERE c.case_id = ? AND c.component_name = (SELECT component_name FROM component WHERE component_id = ?)
        ORDER BY b.cost_kind`,
      [dup.json.case_id, w.P.base.op],
    );
    expect(copied).toEqual([
      { cost_kind: 'labor', rate: 25.83, source_kind: 'reference' },
      { cost_kind: 'energy', rate: 0.09, source_kind: 'entered' },
    ]);

    // Scale the copy from 1 to 2 units: driver and amount double, the rate stays.
    const copyOp = (await sqlOne<any>(
      `SELECT component_id FROM component WHERE case_id = ? AND component_name = (SELECT component_name FROM component WHERE component_id = ?)`,
      [dup.json.case_id, w.P.base.op],
    )).component_id;
    const product = await sqlOne<any>(`SELECT quantity FROM component WHERE case_id = ? AND parent_component_id IS NULL`, [dup.json.case_id]);
    const scale = await api.post(`/api/cases/${dup.json.case_id}/scale`, {
      token: t,
      json: { from: Number(product.quantity), to: Number(product.quantity) * 2, mode: 'scale-inputs' },
    });
    expect(scale.status, scale.text).toBe(200);
    const scaled = await sqlOne<any>(
      `SELECT driver_quantity, rate FROM component_cost_basis WHERE component_id = ? AND cost_kind = 'labor'`,
      [copyOp],
    );
    expect(scaled).toEqual({ driver_quantity: 0.03, rate: 25.83 });
  });

  it('DELETE clears one cost and its basis; an unknown kind is 400', async () => {
    const t = w.users.editor.token;
    const del = await api.delete(`${url()}?kind=energy`, { token: t });
    expect(del.status).toBe(200);
    expect(kind(del.json, 'energy')).toEqual({ kind: 'energy', amount: null, basis: null });
    expect((await api.delete(`${url()}?kind=fuel`, { token: t })).status).toBe(400);
    expect((await api.delete(`${url()}?kind=energy`, { token: w.users.viewer.token })).status).toBe(403);
  });
});
