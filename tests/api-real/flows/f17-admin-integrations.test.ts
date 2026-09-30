/**
 * F17. Admin integrations: a platform admin refreshes shared reference data
 * (with every upstream mocked) and reads the log; nobody else can.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { mockOutbound, outbound } from '../support/outbound';
import { createUser, makePlatformAdmin, type TestUser } from '../support/users';

let admin: TestUser;
let user: TestUser;
beforeAll(async () => {
  [admin, user] = await Promise.all([createUser('f17admin'), createUser('f17user')]);
  await makePlatformAdmin(admin);
});

/** Live factors that have a QUARANTINE twin (same substance, category, scope). */
const revived = () =>
  sql(
    `SELECT live.factor_id FROM driver_impact_factors live
       JOIN driver_impact_factors q
         ON q.substance_id = live.substance_id AND q.category_id = live.category_id
        AND q.geographic_scope = live.geographic_scope
        AND q.method_name = CONCAT('QUARANTINE: ', live.method_name)`,
  );

describe('F17 admin integrations', () => {
  it('F17.1 the status page loads for the admin and lists the sources', async () => {
    const res = await api.get('/api/integrations/status', { token: admin.token });
    expect(res.status).toBe(200);
    expect(res.json.sources.map((s: any) => s.id)).toEqual(['openlca', 'pubchem', 'electricity_maps', 'eia', 'metals', 'bls']);
    expect(res.json.sources.find((s: any) => s.id === 'eia')).toMatchObject({ configured: false, status: 'static' });
    expect(res.json.factorsByMethod.some((m: any) => m.method_name === 'CML 2001')).toBe(true);
  });

  it('F17.2 openLCA import is insert-only and never revives a quarantined factor (E2)', async () => {
    const before = await revived();
    expect(before).toEqual([]);
    for (const method of ['TRACI 2.1', 'CML 2001', 'ReCiPe Midpoint (H)']) {
      const res = await api.post('/api/integrations/openlca/import', { token: admin.token, json: { method } });
      expect(res.status, res.text).toBe(200);
      expect(res.json.result).toEqual(expect.objectContaining({ failed: 0 }));
    }
    expect(await revived()).toEqual([]);
    const bad = await api.post('/api/integrations/openlca/import', { token: admin.token, json: { method: 'QUARANTINE: TRACI 2.1' } });
    expect(bad.status).toBe(400);
  });

  it('F17.3 PubChem enrichment (mocked) updates substances and logs the run', async () => {
    const res = await api.post('/api/integrations/pubchem/enrich', { token: admin.token, json: { only_missing: true, limit: 2 } });
    expect(res.status, res.text).toBe(200);
    expect(res.json.summary.enriched + res.json.summary.failed + (res.json.summary.skipped ?? 0)).toBeGreaterThan(0);
    expect(outbound.calls.every((c) => c.url.startsWith('https://pubchem.ncbi.nlm.nih.gov/'))).toBe(true);
    const one = await sqlOne(`SELECT substance_id FROM substances WHERE substance_name = 'Carbon dioxide (CO2)'`);
    const single = await api.post('/api/integrations/pubchem/enrich', { token: admin.token, json: { substance_id: Number(one.substance_id) } });
    expect(single.status).toBe(200);
    expect(single.json.result).toBeTruthy();
    const bad = await api.post('/api/integrations/pubchem/enrich', { token: admin.token, json: { limit: 501 } });
    expect(bad.status).toBe(400);
  });

  it('F17.5 electricity sync writes a live reading for a zone with no curated factor and keeps the audited ones (INT-2)', async () => {
    process.env.ELECTRICITY_MAPS_API_KEY = 'test-key';
    try {
      const usBefore = await sqlOne(
        `SELECT d.factor_value, d.source_reference FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
          WHERE s.substance_name = 'Electricity' AND d.method_name = 'CML 2001' AND d.geographic_scope = 'US' AND d.category_id = 1`,
      );
      const res = await api.post('/api/integrations/electricity/sync', { token: admin.token, json: { zones: ['US-CAL-CISO', 'US'] } });
      expect(res.status, res.text).toBe(200);
      const byZone = Object.fromEntries(res.json.results.map((r: any) => [r.zone, r]));
      expect(byZone['US-CAL-CISO']).toMatchObject({ inserted: true, factorValue: 0.231, source: 'live' });
      expect(byZone.US).toMatchObject({ inserted: false });
      const usAfter = await sqlOne(
        `SELECT d.factor_value, d.source_reference FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
          WHERE s.substance_name = 'Electricity' AND d.method_name = 'CML 2001' AND d.geographic_scope = 'US' AND d.category_id = 1`,
      );
      expect(usAfter).toEqual(usBefore);

      // Upstream down: a zone with no factor on file gets the curated yearly
      // average (labelled as a reference), never a zero-carbon grid; a zone
      // with a factor keeps it.
      mockOutbound(/api\.electricitymap\.org/, () => new Response(JSON.stringify({ carbonIntensity: null }), { status: 200 }));
      const down = await api.post('/api/integrations/electricity/sync', { token: admin.token, json: { zones: ['DE', 'US-CAL-CISO'] } });
      expect(down.status, down.text).toBe(200);
      const downBy = Object.fromEntries(down.json.results.map((r: any) => [r.zone, r]));
      expect(downBy.DE).toMatchObject({ inserted: true, source: 'reference', factorValue: 0.38 });
      expect(downBy['US-CAL-CISO']).toMatchObject({ inserted: false, factorValue: 0.231 });
      for (const json of [{}, { zone: 'Atlantis' }, { zones: [] }, { zone: 'US', method: 'EF 3.1' }]) {
        expect((await api.post('/api/integrations/electricity/sync', { token: admin.token, json })).status, JSON.stringify(json)).toBe(400);
      }
    } finally {
      delete process.env.ELECTRICITY_MAPS_API_KEY;
    }
  });

  it('F17.4 the activity log lists what ran; limit is clamped (INT-6)', async () => {
    const res = await api.get('/api/integrations/log?limit=30', { token: admin.token });
    expect(res.status).toBe(200);
    const actions = res.json.logs.map((l: any) => `${l.source}:${l.action}`);
    expect(actions).toEqual(expect.arrayContaining(['openlca:import_method', 'pubchem:enrich_all', 'electricity_maps:sync_zones']));
    for (const [q, max] of [['abc', 20], ['0', 20], ['-5', 20], ['1e3', 20], ['99999', 200], ['1', 1]] as const) {
      const r = await api.get(`/api/integrations/log?limit=${q}`, { token: admin.token });
      expect(r.status, q).toBe(200);
      expect(r.json.logs.length, q).toBeLessThanOrEqual(max);
    }
    const bySource = await api.get('/api/integrations/log?source=openlca', { token: admin.token });
    expect(new Set(bySource.json.logs.map((l: any) => l.source))).toEqual(new Set(['openlca']));
  });

  it('F17.6 an ordinary user gets 403 on every admin action and cannot read the log; anon 401', async () => {
    const actions: Array<[string, string, unknown]> = [
      ['GET', '/api/integrations/log', undefined],
      ['POST', '/api/integrations/openlca/import', { method: 'CML 2001' }],
      ['POST', '/api/integrations/pubchem/enrich', { only_missing: true }],
      ['POST', '/api/integrations/electricity/sync', { zone: 'US' }],
    ];
    const before = await sqlOne('SELECT COUNT(*) AS n FROM integration_log');
    for (const [method, url, json] of actions) {
      const r = method === 'GET' ? await api.get(url, { token: user.token }) : await api.post(url, { token: user.token, json });
      expect(r.status, url).toBe(403);
      expect(r.json).toEqual({ error: 'Admin privileges required' });
      const anon = method === 'GET' ? await api.get(url) : await api.post(url, { json });
      expect(anon.status, url).toBe(401);
    }
    expect(await sqlOne('SELECT COUNT(*) AS n FROM integration_log')).toEqual(before);
    expect(outbound.calls).toEqual([]);
  });
});
