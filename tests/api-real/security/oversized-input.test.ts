/**
 * Oversized and malformed JSON bodies: a request the client controls must
 * get a 4xx, never a 500 (a 500 here is a database error the route did not
 * validate for: MySQL strict mode refuses a value longer than its column).
 * Cells that answer 500 today are it.fails, each naming its cause.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { rowCounts, tableChecksums } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

type Probe = { method: 'POST' | 'PUT'; url: (w: World) => string; token: (w: World) => string };
const P = (method: Probe['method'], url: Probe['url'], token: Probe['token'] = (w) => w.users.owner.token): Probe => ({ method, url, token });

const send = (p: Probe, opts: { json?: unknown; raw?: string }) =>
  p.method === 'POST' ? api.post(p.url(w), { token: p.token(w), ...opts }) : api.put(p.url(w), { token: p.token(w), ...opts });

// ── Malformed JSON ──────────────────────────────────────────────────────────
// Routes whose body is optional by design (duplicate, pubchem enrich) or that
// answer before parsing (insights without a model key) are not listed.
const JSON_ROUTES: Array<[string, Probe, string | null]> = [
  ['POST /api/auth/signup', P('POST', () => '/api/auth/signup'), null],
  ['POST /api/auth/login', P('POST', () => '/api/auth/login'), null],
  ['PUT /api/auth/profile', P('PUT', () => '/api/auth/profile'), null],
  ['POST /api/projects', P('POST', () => '/api/projects'), null],
  ['PUT /api/projects/:id', P('PUT', (w) => `/api/projects/${w.P.id}`), null],
  ['POST /api/projects/:id/cases', P('POST', (w) => `/api/projects/${w.P.id}/cases`), null],
  ['POST /api/projects/:id/members', P('POST', (w) => `/api/projects/${w.P.id}/members`), null],
  ['PUT /api/cases/:id', P('PUT', (w) => `/api/cases/${w.P.base.id}`), null],
  ['POST /api/cases/:id/assessments', P('POST', (w) => `/api/cases/${w.P.base.id}/assessments`), null],
  ['POST /api/cases/:id/clone-from', P('POST', (w) => `/api/cases/${w.P.base.id}/clone-from`), null],
  ['POST /api/cases/:id/scale', P('POST', (w) => `/api/cases/${w.P.base.id}/scale`), null],
  ['POST /api/cases/:id/components', P('POST', (w) => `/api/cases/${w.P.base.id}/components`), null],
  ['PUT /api/components/:id', P('PUT', (w) => `/api/components/${w.P.base.op}`), null],
  ['POST /api/components/:id/flows', P('POST', (w) => `/api/components/${w.P.base.task}/flows`), null],
  ['PUT /api/flows/:id', P('PUT', (w) => `/api/flows/${w.P.base.flow}`), null],
  ['POST /api/comparisons', P('POST', () => '/api/comparisons'), null],
  ['POST /api/substances', P('POST', () => '/api/substances'), null],
  ['POST /api/ingest/apply', P('POST', () => '/api/ingest/apply'), null],
  ['POST /api/integrations/bls/fetch-wage', P('POST', () => '/api/integrations/bls/fetch-wage'), null],
  ['POST /api/integrations/openlca/import', P('POST', () => '/api/integrations/openlca/import', (w) => w.users.padmin.token), null],
  ['POST /api/integrations/electricity/sync', P('POST', () => '/api/integrations/electricity/sync', (w) => w.users.padmin.token), null],
];

describe('malformed JSON body -> 4xx', () => {
  for (const [name, probe, bug] of JSON_ROUTES) {
    const test = async () => {
      const before = await rowCounts();
      for (const raw of ['{not json', '{"a":', '\u0000\u0001', '"just a string"', '[]']) {
        const res = await send(probe, { raw });
        expect(res.status, `${name} ${JSON.stringify(raw)}: ${res.text.slice(0, 120)}`).toBeGreaterThanOrEqual(400);
        expect(res.status, `${name} ${JSON.stringify(raw)}`).toBeLessThan(500);
      }
      expect(await rowCounts()).toEqual(before);
    };
    // Fixed: every route reads its body with lib/http.ts readJson, which
    // answers 400 for invalid JSON or a body that is not an object.
    if (bug) it.fails(`${name} (500 today: ${bug})`, test);
    else it(name, test);
  }
});

// ── Oversized fields ───────────────────────────────────────────────────────
const LONG = (n: number) => 'L'.repeat(n);

// The fourth column: the 400 error a too-long value must get (the route names
// the field), or null where 2xx (a safe truncation) or any other 4xx is fine.
const FIELD_PROBES: Array<[string, Probe, (w: World) => unknown, RegExp | null]> = [
  ['POST /api/projects project_name 101 chars (VARCHAR 100)', P('POST', () => '/api/projects'), () => ({ project_name: LONG(101) }), /project name.*100 characters/i],
  ['POST /api/projects description 70 KB (TEXT)', P('POST', () => '/api/projects'), () => ({ project_name: 'ok name', description: LONG(70_000) }), /description is too long/i],
  ['PUT /api/projects/:id functional_unit 256 chars (VARCHAR 255)', P('PUT', (w) => `/api/projects/${w.P.id}`), () => ({ functional_unit: LONG(256) }), /functional unit.*255 characters/i],
  ['PUT /api/projects/:id project_name 101 chars', P('PUT', (w) => `/api/projects/${w.P.id}`), () => ({ project_name: LONG(101) }), /project name.*100 characters/i],
  ['POST /api/projects/:id/cases case_name 101 chars (VARCHAR 100)', P('POST', (w) => `/api/projects/${w.P.id}/cases`), () => ({ case_name: LONG(101), case_type: 'base' }), /case name.*100 characters/i],
  ['PUT /api/cases/:id case_name 101 chars', P('PUT', (w) => `/api/cases/${w.P.base.id}`), () => ({ case_name: LONG(101) }), /case name.*100 characters/i],
  ['PUT /api/cases/:id reference_flow_unit 51 chars', P('PUT', (w) => `/api/cases/${w.P.base.id}`), () => ({ reference_flow_unit: LONG(51) }), /reference flow unit.*50 characters/i],
  ['POST /api/cases/:id/duplicate case_name 150 chars', P('POST', (w) => `/api/cases/${w.P.base.id}/duplicate`), () => ({ case_name: LONG(150) }), /case name.*100 characters/i],
  ['POST /api/cases/:id/components unit 51 chars', P('POST', (w) => `/api/cases/${w.P.base.id}/components`), () => ({ component_name: 'ok', component_type: 'operation', unit: LONG(51) }), /unit.*50 characters/i],
  ['POST /api/cases/:id/components process_type 101 chars', P('POST', (w) => `/api/cases/${w.P.base.id}/components`), () => ({ component_name: 'ok', component_type: 'operation', process_type: LONG(101) }), /process type.*100 characters/i],
  ['PUT /api/components/:id process_type 101 chars', P('PUT', (w) => `/api/components/${w.P.base.op}`), () => ({ process_type: LONG(101) }), /process type.*100 characters/i],
  ['PUT /api/components/:id component_description 70 KB', P('PUT', (w) => `/api/components/${w.P.base.op}`), () => ({ component_description: LONG(70_000) }), /description is too long/i],
  ['POST /api/components/:id/flows driver_description 70 KB', P('POST', (w) => `/api/components/${w.P.base.task}/flows`),
    (w) => ({ substance_id: w.substances.electricity, flow_type: 'input', quantity: 1, unit: 'kWh', driver_description: LONG(70_000) }), /description is too long/i],
  ['POST /api/ingest/apply case_name 150 chars', P('POST', () => '/api/ingest/apply'),
    (w) => ({ project_id: w.P.id, case_name: LONG(150), nodes: [{ name: 'A', tier: 'product', parent: null }], flows: [], costs: [], notes: [] }), /case_name.*100/i],
  ['PUT /api/auth/profile company 161 chars', P('PUT', () => '/api/auth/profile'), () => ({ fullName: 'ok', company: LONG(161) }), /company.*160 characters/i],
  ['POST /api/projects/:id/members email 5 KB', P('POST', (w) => `/api/projects/${w.P.id}/members`), () => ({ email: `${LONG(5000)}@x.test`, role: 'viewer' }), null],
  ['POST /api/auth/signup email 5 KB', P('POST', () => '/api/auth/signup'), () => ({ email: `${LONG(5000)}@x.test`, password: 'Long-enough-1' }), null],
  ['POST /api/auth/login password 5 KB', P('POST', () => '/api/auth/login'), () => ({ email: 'a@b.test', password: LONG(5000) }), null],
  ['POST /api/substances name 5 KB', P('POST', () => '/api/substances'),
    () => ({ name: LONG(5000), kind: 'input', unit: 'kg', method: 'CML 2001', impactCategory: 'Global Warming', factorValue: 1, source: 'EPD 2025' }), null],
  ['PUT /api/cases/:id interpretation 5 MB (truncated to 20,000)', P('PUT', (w) => `/api/cases/${w.P.base.id}`), () => ({ interpretation: LONG(5 * 1024 * 1024) }), null],
  ['POST /api/insights 5 MB', P('POST', () => '/api/insights'), () => ({ mode: 'summary', caseName: LONG(5 * 1024 * 1024) }), null],
];

describe('oversized fields -> 4xx or a safe truncation, never 500', () => {
  // Each route checks string lengths against the column sizes in
  // lib/field-limits.ts before it writes anything, and answers 400 naming the
  // field (it used to answer 500, or a misleading 409 "needs migrate-014").
  for (const [name, probe, body, refusal] of FIELD_PROBES) {
    it(name, async () => {
      const before = refusal ? await tableChecksums() : null;
      const res = await send(probe, { json: body(w) });
      expect(res.status, `${name}: ${res.text.slice(0, 160)}`).toBeLessThan(500);
      expect(res.status === 200 || res.status === 201 || (res.status >= 400 && res.status < 500 && res.status !== 409)).toBe(true);
      if (refusal) {
        expect(res.status, res.text.slice(0, 160)).toBe(400);
        expect(res.json.error).toMatch(refusal);
        expect(await tableChecksums(), `${name}: a refused write must change nothing`).toEqual(before);
      }
    });
  }
});

describe('numbers the columns cannot hold', () => {
  // Fixed: lib/component-fields.ts and the scale route check numbers against
  // the DECIMAL(15,6) quantity column (largest 999,999,999.999999).
  it('component quantity 1e20 and scale to 1e300 -> 400', async () => {
    const q = await api.put(`/api/components/${w.P.base.op}`, { token: w.users.owner.token, json: { quantity: 1e20 } });
    expect(q.status).toBe(400);
    const s = await api.post(`/api/cases/${w.P.base.id}/scale`, { token: w.users.owner.token, json: { from: 1, to: 1e300, mode: 'data-covers' } });
    expect(s.status).toBe(400);
  });

  it('a non-finite flow quantity (1e309 in raw JSON) is refused with 400', async () => {
    const flow = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: w.users.owner.token,
      raw: `{"substance_id":${w.substances.electricity},"flow_type":"input","quantity":1e309,"unit":"kWh"}`,
    });
    expect(flow.status).toBe(400);
  });

  // Fixed: the scale route requires finite amounts within the column (JSON
  // 1e309 parses to Infinity, which the old `t > 0` check let through).
  it('scale to a non-finite amount (1e309) -> 400', async () => {
    const scale = await api.post(`/api/cases/${w.P.base.id}/scale`, { token: w.users.owner.token, raw: '{"from":1,"to":1e309,"mode":"data-covers"}' });
    expect(scale.status).toBe(400);
  });
});
