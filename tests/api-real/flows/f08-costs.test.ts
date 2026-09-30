/**
 * F8. Costs: the cost columns through PUT /api/components/:id (0 kept, null
 * clears), the labour and energy lookups, auto-costs and scaling.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sqlOne } from '../support/db';
import { outbound } from '../support/outbound';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

const COSTS = ['labor_cost', 'energy_cost', 'material_cost', 'transportation_cost', 'equipment_cost', 'overhead_cost'] as const;
const costsOf = (id: number) =>
  sqlOne(`SELECT ${COSTS.join(', ')}, labor_hours, labor_occupation, currency, cost_allocation_type FROM component WHERE component_id = ?`, [id]);

describe('F8 costs', () => {
  it('F8.1-F8.3 saves every cost column; 0 stays 0; null clears to NULL (FLOW-3 fixed)', async () => {
    const t = w.users.editor.token;
    const id = w.P.base.task;
    const res = await api.put(`/api/components/${id}`, {
      token: t,
      json: {
        labor_cost: 12.5, energy_cost: 0, material_cost: 3.25, transportation_cost: 1, equipment_cost: 0.4, overhead_cost: 2,
        labor_hours: 0.5, labor_occupation: '51-9195', currency: 'eur', cost_allocation_type: 'calculated',
      },
    });
    expect(res.status, res.text).toBe(200);
    expect(await costsOf(id)).toEqual({
      labor_cost: '12.50', energy_cost: '0.00', material_cost: '3.25', transportation_cost: '1.00', equipment_cost: '0.40', overhead_cost: '2.00',
      labor_hours: '0.5000', labor_occupation: '51-9195', currency: 'EUR', cost_allocation_type: 'calculated',
    });

    const cleared = await api.put(`/api/components/${id}`, { token: t, json: { labor_cost: null, energy_cost: '', labor_hours: null } });
    expect(cleared.status).toBe(200);
    const after = await costsOf(id);
    expect(after).toMatchObject({ labor_cost: null, energy_cost: null, labor_hours: null, material_cost: '3.25' });

    // A save that sends no cost keys leaves the costs alone.
    await api.put(`/api/components/${id}`, { token: t, json: { component_name: `Mold Cleaning ${w.tag}` } });
    expect((await costsOf(id)).material_cost).toBe('3.25');
  });

  it('400 for a negative or non-numeric cost, a bad SOC code, currency or allocation type (COST-8 fixed)', async () => {
    const t = w.users.editor.token;
    for (const json of [
      { labor_cost: -1 },
      { energy_cost: 'cheap' },
      { labor_hours: -0.5 },
      { labor_occupation: 'welder-in-chief' },
      { currency: 'dollars' },
      { cost_allocation_type: 'guessed' },
      { opex: -3 },
    ]) {
      const r = await api.put(`/api/components/${w.P.base.op}`, { token: t, json });
      expect(r.status, JSON.stringify(json)).toBe(400);
    }
  });

  // Fixed (FLOW-2 follow-up): lib/component-fields.ts checks every number
  // against its DECIMAL column (costs DECIMAL(15,2), hours DECIMAL(10,4)), so a
  // value MySQL would refuse as "Out of range" is a 400 naming the field.
  it('a cost larger than its column gets 400, not 500', async () => {
    const before = await costsOf(w.P.base.op);
    for (const json of [{ labor_cost: 1e20 }, { opex: 1e13 }, { labor_hours: 1e6 }]) {
      const r = await api.put(`/api/components/${w.P.base.op}`, { token: w.users.editor.token, json });
      expect(r.status, JSON.stringify(json)).toBe(400);
      expect(r.json.error).toMatch(new RegExp(`${Object.keys(json)[0]} must be at most`));
    }
    expect(await costsOf(w.P.base.op)).toEqual(before);
    // The column's largest value is accepted.
    const max = await api.put(`/api/components/${w.P.base.op}`, { token: w.users.editor.token, json: { overhead_cost: 9999999999999.99 } });
    expect(max.status, max.text).toBe(200);
    await api.put(`/api/components/${w.P.base.op}`, { token: w.users.editor.token, json: { overhead_cost: before.overhead_cost } });
  });

  it('F8.4/F8.7 an ordinary user looks up a state wage, an energy price and a metal price (D6)', async () => {
    const t = w.users.editor.token;
    const wage = await api.post('/api/integrations/bls/fetch-wage', { token: t, json: { occupation: '51-4121', state: 'NC' } });
    expect(wage.status, wage.text).toBe(200);
    expect(wage.json.rate).toMatchObject({ rateValue: 23.87, unit: '$/hr', source: 'BLS OEWS 2025' });
    expect(outbound.calls.some((c) => c.url.startsWith('https://api.bls.gov/'))).toBe(true);
    // Cached: the second lookup does not go upstream.
    outbound.calls.length = 0;
    const again = await api.post('/api/integrations/bls/fetch-wage', { token: t, json: { occupation: '51-4121', state: 'NC' } });
    expect(again.json.rate.rateValue).toBe(23.87);
    expect(outbound.calls).toEqual([]);

    // No EIA or Metals key: the static reference rate, never cached.
    const energy = await api.post('/api/integrations/eia/fetch-energy-price', { token: t, json: { fuel: 'electricity', state: 'NC' } });
    expect(energy.status).toBe(200);
    expect(energy.json.rate.source).toMatch(/^Reference /);
    const metal = await api.post('/api/integrations/metals/fetch-price', { token: t, json: { symbol: 'ALU' } });
    expect(metal.status).toBe(200);
    expect(metal.json.rate.unit).toBe('$/kg');

    // With a key, the live (mocked) upstream price is used and cached.
    process.env.METALS_API_KEY = 'test-key';
    try {
      const live = await api.post('/api/integrations/metals/fetch-price', { token: t, json: { symbol: 'XCU' } });
      expect(live.json.rate).toMatchObject({ rateValue: 2.3855, unit: '$/kg' });
    } finally {
      delete process.env.METALS_API_KEY;
    }

    for (const [path, json] of [
      ['/api/integrations/bls/fetch-wage', { occupation: "51-4121' OR 1=1", state: 'NC' }],
      ['/api/integrations/bls/fetch-wage', { occupation: '51-4121', state: 'ZZ' }],
      ['/api/integrations/eia/fetch-energy-price', { fuel: 'coal', state: 'NC' }],
      ['/api/integrations/metals/fetch-price', { symbol: 'GOLD' }],
      ['/api/integrations/metals/fetch-price', { symbol: 'ALU', extra: 1 }],
    ] as const) {
      const r = await api.post(path, { token: t, json });
      expect(r.status, JSON.stringify(json)).toBe(400);
      expect(r.text).not.toContain("OR 1=1");
    }
  });

  it('F8.8 auto-costs: an editor fills labour and energy cost from hours and flows', async () => {
    await api.put(`/api/components/${w.P.base.task}`, { token: w.users.editor.token, json: { labor_hours: 2, labor_occupation: '51-4121' } });
    const res = await api.post(`/api/components/${w.P.base.task}/auto-costs`, { token: w.users.editor.token });
    expect(res.status, res.text).toBe(200);
    expect(res.json.success).toBe(true);
    const row = await costsOf(w.P.base.task);
    expect(Number(row.labor_cost)).toBeGreaterThan(0);
  });

  it('F12.4 scale-inputs multiplies flows and per-unit costs; data-covers only moves the data basis', async () => {
    const copy = await w.fresh.caseCopy();
    const flowsBefore = await sqlOne(
      'SELECT SUM(f.quantity) AS q FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ?',
      [copy],
    );
    const res = await api.post(`/api/cases/${copy}/scale`, { token: w.users.editor.token, json: { from: 1, to: 4, mode: 'scale-inputs' } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ mode: 'scale-inputs', factor: 4 });
    const flowsAfter = await sqlOne(
      'SELECT SUM(f.quantity) AS q FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ?',
      [copy],
    );
    expect(Number(flowsAfter.q)).toBeCloseTo(Number(flowsBefore.q) * 4, 9);
    expect(Number((await sqlOne('SELECT modeled_output FROM case_table WHERE case_id = ?', [copy])).modeled_output)).toBe(4);

    const covers = await api.post(`/api/cases/${copy}/scale`, { token: w.users.editor.token, json: { from: 4, to: 10, mode: 'data-covers' } });
    expect(covers.status).toBe(200);
    const flowsCovers = await sqlOne(
      'SELECT SUM(f.quantity) AS q FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ?',
      [copy],
    );
    expect(Number(flowsCovers.q)).toBeCloseTo(Number(flowsAfter.q), 9);
    for (const json of [{ from: 0, to: 2, mode: 'scale-inputs' }, { from: 1, to: -2, mode: 'scale-inputs' }, { from: 1, to: 2, mode: 'double' }]) {
      expect((await api.post(`/api/cases/${copy}/scale`, { token: w.users.editor.token, json })).status, JSON.stringify(json)).toBe(400);
    }
  });

  // BUG COST-7 (app/api/cases/[caseId]/scale/route.ts:53 scales by the
  // client's from/to, not by the stored product quantity): replaying the same
  // "1 -> 2" request (a retry, a double click) scales the inventory twice.
  it.fails('replaying a scale request does not scale twice (COST-7)', async () => {
    const copy = await w.fresh.caseCopy();
    const sum = async () =>
      Number(
        (await sqlOne('SELECT SUM(f.quantity) AS q FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ?', [copy])).q,
      );
    const before = await sum();
    for (let i = 0; i < 2; i++) {
      await api.post(`/api/cases/${copy}/scale`, { token: w.users.editor.token, json: { from: 1, to: 2, mode: 'scale-inputs' } });
    }
    expect(await sum()).toBeCloseTo(before * 2, 9);
  });
});
