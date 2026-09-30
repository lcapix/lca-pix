/**
 * F16. Library: factors and substances, and custom-substance privacy. A
 * custom substance is visible and usable only by its author (L3, FAC-1,
 * FAC-4).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { createUser, type TestUser } from '../support/users';

let a: TestUser;
let b: TestUser;
let privateName: string;
let privateId: number;
beforeAll(async () => {
  [a, b] = await Promise.all([createUser('f16a'), createUser('f16b')]);
  privateName = `Recycled glaze frit (A only) ${a.id}`;
  const res = await api.post('/api/substances', {
    token: a.token,
    json: {
      name: privateName,
      kind: 'input',
      unit: 'kg',
      method: 'TRACI 2.1',
      impactCategory: 'Global Warming',
      factorValue: 0.8,
      factorUnit: 'kg CO2 eq/kg',
      source: 'Supplier EPD 2025, unpublished',
      casNumber: '65997-17-3',
    },
  });
  expect(res.status, res.text).toBe(201);
  privateId = Number(res.json.substance.substance_id);
});

describe('F16 library', () => {
  it('F16.3 the author adds a substance with one factor, marked unverified', async () => {
    const s = await sqlOne('SELECT is_custom, created_by, unit, cas_number FROM substances WHERE substance_id = ?', [privateId]);
    expect(s).toEqual({ is_custom: 1, created_by: a.id, unit: 'kg', cas_number: '65997-17-3' });
    const f = await sql('SELECT method_name, factor_value, geographic_scope, source_reference FROM driver_impact_factors WHERE substance_id = ?', [privateId]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ method_name: 'TRACI 2.1', geographic_scope: 'Global' });
    expect(f[0].source_reference).toMatch(/Supplier EPD 2025/);
  });

  it('F16.1-F16.2 the author sees it in substances and factors; B does not', async () => {
    const aSubs = await api.get('/api/substances', { token: a.token });
    expect(aSubs.json.substances.map((s: any) => s.substance_id)).toContain(privateId);
    const bSubs = await api.get('/api/substances', { token: b.token });
    expect(bSubs.status).toBe(200);
    expect(bSubs.json.substances.length).toBeGreaterThan(1000);
    expect(bSubs.text).not.toContain(privateName);

    const aFactors = await api.get(`/api/driver-factors?substance_id=${privateId}`, { token: a.token });
    expect(aFactors.json.factors).toHaveLength(1);
    const bFactors = await api.get(`/api/driver-factors?substance_id=${privateId}`, { token: b.token });
    expect(bFactors.json.factors).toEqual([]);
    const all = await api.get('/api/driver-factors', { token: b.token });
    expect(all.text).not.toContain(privateName);
    // The library listing never shows quarantined rows (FAC-1).
    expect(all.json.factors.some((f: any) => /^QUARANTINE/.test(f.method_name))).toBe(false);
    const quarantined = await sqlOne(`SELECT COUNT(*) AS n FROM driver_impact_factors WHERE method_name LIKE 'QUARANTINE%'`);
    expect(Number(quarantined.n)).toBeGreaterThan(0);
  });

  it('F16.4 B cannot use it in a flow, nor learn its name from a duplicate-name 409 (FAC-4)', async () => {
    const dup = await api.post('/api/substances', {
      token: b.token,
      json: { name: privateName, kind: 'input', unit: 'kg', method: 'CML 2001', impactCategory: 'Global Warming', factorValue: 1, source: 'My own EPD 2025' },
    });
    expect(dup.status).toBe(409);
    expect(dup.text).not.toContain(String(privateId));
    expect(dup.json.substance_id).toBeUndefined();
    expect(dup.json.error).toBe('That name is already taken. Add a distinguishing detail (supplier, grade, region) to the name.');
    // The substances table did not grow a half-inserted row.
    expect(await sql('SELECT substance_id FROM substances WHERE substance_name = ?', [privateName])).toHaveLength(1);

    // A library name gives the helpful 409 with its id.
    const lib = await api.post('/api/substances', {
      token: b.token,
      json: { name: 'electricity', kind: 'input', unit: 'kWh', method: 'CML 2001', impactCategory: 'Global Warming', factorValue: 0.4, source: 'Grid EPD 2025' },
    });
    expect(lib.status).toBe(409);
    expect(lib.json.error).toMatch(/"Electricity" is already in the catalog/);
  });

  it('400 when validation fails', async () => {
    const good = { name: `Valid ${b.id}`, kind: 'input', unit: 'kg', method: 'CML 2001', impactCategory: 'Global Warming', factorValue: 1, source: 'Supplier EPD' };
    for (const patch of [
      { name: 'x' },
      { name: 'n'.repeat(121) },
      { kind: 'waste' },
      { unit: 'furlongs' },
      { method: 'EF 3.1' },
      { factorValue: 0 },
      { factorValue: -2 },
      { factorValue: 'high' },
      { source: 'abc' },
      { impactCategory: '' },
    ]) {
      const r = await api.post('/api/substances', { token: b.token, json: { ...good, ...patch } });
      expect(r.status, JSON.stringify(patch)).toBe(400);
    }
    const noCategory = await api.post('/api/substances', { token: b.token, json: { ...good, impactCategory: 'Vibes' } });
    expect(noCategory.status).toBe(400);
    expect(noCategory.json.error).toBe('No impact category called "Vibes".');
  });

  it('impact categories and the process library are readable by any signed-in user', async () => {
    const cats = await api.get('/api/impact-categories', { token: b.token });
    expect(cats.json.categories.map((c: any) => c.category_name)).toContain('Global Warming');
    expect((await api.get('/api/process-templates', { token: b.token })).json.templates.length).toBeGreaterThan(0);
  });
});
