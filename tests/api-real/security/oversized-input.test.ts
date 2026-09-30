/**
 * Oversized and malformed JSON bodies: a request the client controls must
 * get a 4xx, never a 500 (a 500 here is a database error the route did not
 * validate for: MySQL strict mode refuses a value longer than its column).
 * Cells that answer 500 today are it.fails, each naming its cause.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { rowCounts } from '../support/db';
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

const FIELD_PROBES: Array<[string, Probe, (w: World) => unknown, string | null]> = [
  ['POST /api/projects project_name 101 chars (VARCHAR 100)', P('POST', () => '/api/projects'), () => ({ project_name: LONG(101) }),
    'app/api/projects/route.ts:48 checks only that the name is not empty; the INSERT at :67 fails, project.project_name is VARCHAR(100)'],
  ['POST /api/projects description 70 KB (TEXT)', P('POST', () => '/api/projects'), () => ({ project_name: 'ok name', description: LONG(70_000) }),
    'app/api/projects/route.ts:67 writes description unchecked; project.description is TEXT (64 KB)'],
  ['PUT /api/projects/:id functional_unit 256 chars (VARCHAR 255)', P('PUT', (w) => `/api/projects/${w.P.id}`), () => ({ functional_unit: LONG(256) }),
    'app/api/projects/[projectId]/route.ts:107 writes functional_unit unchecked (VARCHAR(255)); the catch at :119 reports every failure as "needs migrate-014" (409)'],
  ['PUT /api/projects/:id project_name 101 chars', P('PUT', (w) => `/api/projects/${w.P.id}`), () => ({ project_name: LONG(101) }),
    'app/api/projects/[projectId]/route.ts:81 writes the name unchecked; VARCHAR(100)'],
  ['POST /api/projects/:id/cases case_name 101 chars (VARCHAR 100)', P('POST', (w) => `/api/projects/${w.P.id}/cases`), () => ({ case_name: LONG(101), case_type: 'base' }),
    'app/api/projects/[projectId]/cases/route.ts:64 checks only presence; the INSERT at :90 fails, case_table.case_name is VARCHAR(100)'],
  ['PUT /api/cases/:id case_name 101 chars', P('PUT', (w) => `/api/cases/${w.P.base.id}`), () => ({ case_name: LONG(101) }),
    'app/api/cases/[caseId]/route.ts:78 checks only that the name is not blank; VARCHAR(100)'],
  ['PUT /api/cases/:id reference_flow_unit 51 chars', P('PUT', (w) => `/api/cases/${w.P.base.id}`), () => ({ reference_flow_unit: LONG(51) }),
    'app/api/cases/[caseId]/route.ts:175 writes reference_flow_unit unchecked (VARCHAR(50)); the catch at :188 reports it as "needs migrate-014" (409)'],
  ['POST /api/cases/:id/duplicate case_name 150 chars', P('POST', (w) => `/api/cases/${w.P.base.id}/duplicate`), () => ({ case_name: LONG(150) }),
    'app/api/cases/[caseId]/duplicate/route.ts:54 slices the name to 255 characters; the column holds 100'],
  ['POST /api/cases/:id/components unit 51 chars', P('POST', (w) => `/api/cases/${w.P.base.id}/components`), () => ({ component_name: 'ok', component_type: 'operation', unit: LONG(51) }),
    'app/api/cases/[caseId]/components/route.ts:186 POST writes unit unchecked (PUT checks it); component.unit is VARCHAR(50)'],
  ['POST /api/cases/:id/components process_type 101 chars', P('POST', (w) => `/api/cases/${w.P.base.id}/components`), () => ({ component_name: 'ok', component_type: 'operation', process_type: LONG(101) }),
    'app/api/cases/[caseId]/components/route.ts:181 writes process_type/driver_category/driver_type unchecked; VARCHAR(100)'],
  ['PUT /api/components/:id process_type 101 chars', P('PUT', (w) => `/api/components/${w.P.base.op}`), () => ({ process_type: LONG(101) }),
    'app/api/components/[componentId]/route.ts:192 writes process_type/driver_* unchecked; VARCHAR(100)'],
  ['PUT /api/components/:id component_description 70 KB', P('PUT', (w) => `/api/components/${w.P.base.op}`), () => ({ component_description: LONG(70_000) }),
    'app/api/components/[componentId]/route.ts:135 writes the description unchecked; component.description is TEXT'],
  ['POST /api/components/:id/flows driver_description 70 KB', P('POST', (w) => `/api/components/${w.P.base.task}/flows`),
    (w) => ({ substance_id: w.substances.electricity, flow_type: 'input', quantity: 1, unit: 'kWh', driver_description: LONG(70_000) }),
    'app/api/components/[componentId]/flows/route.ts:100 takes driver_description unchecked; flows.driver_description is TEXT'],
  ['POST /api/ingest/apply case_name 150 chars', P('POST', () => '/api/ingest/apply'),
    (w) => ({ project_id: w.P.id, case_name: LONG(150), nodes: [{ name: 'A', tier: 'product', parent: null }], flows: [], costs: [], notes: [] }),
    'app/api/ingest/apply/route.ts:89 allows a 255-character case name; case_table.case_name is VARCHAR(100)'],
  ['PUT /api/auth/profile company 161 chars', P('PUT', () => '/api/auth/profile'), () => ({ fullName: 'ok', company: LONG(161) }),
    'PROF-1: app/api/auth/profile/route.ts:104 UPDATE with no length checks'],
  ['POST /api/projects/:id/members email 5 KB', P('POST', (w) => `/api/projects/${w.P.id}/members`), () => ({ email: `${LONG(5000)}@x.test`, role: 'viewer' }), null],
  ['POST /api/auth/signup email 5 KB', P('POST', () => '/api/auth/signup'), () => ({ email: `${LONG(5000)}@x.test`, password: 'Long-enough-1' }), null],
  ['POST /api/auth/login password 5 KB', P('POST', () => '/api/auth/login'), () => ({ email: 'a@b.test', password: LONG(5000) }), null],
  ['POST /api/substances name 5 KB', P('POST', () => '/api/substances'),
    () => ({ name: LONG(5000), kind: 'input', unit: 'kg', method: 'CML 2001', impactCategory: 'Global Warming', factorValue: 1, source: 'EPD 2025' }), null],
  ['PUT /api/cases/:id interpretation 5 MB (truncated to 20,000)', P('PUT', (w) => `/api/cases/${w.P.base.id}`), () => ({ interpretation: LONG(5 * 1024 * 1024) }), null],
  ['POST /api/insights 5 MB', P('POST', () => '/api/insights'), () => ({ mode: 'summary', caseName: LONG(5 * 1024 * 1024) }), null],
];

describe('oversized fields -> 4xx or a safe truncation, never 500', () => {
  for (const [name, probe, body, bug] of FIELD_PROBES) {
    const test = async () => {
      const res = await send(probe, { json: body(w) });
      expect(res.status, `${name}: ${res.text.slice(0, 160)}`).toBeLessThan(500);
      expect(res.status === 200 || res.status === 201 || (res.status >= 400 && res.status < 500 && res.status !== 409)).toBe(true);
    };
    // BUG (Medium, validation): the route writes a client string into a
    // column without checking its length; MySQL strict mode refuses it and the
    // route answers 500 (or, where the catch assumes a missing migration, a
    // misleading 409). Cause per row.
    if (bug) it.fails(`${name} (${bug})`, test);
    else it(name, test);
  }
});

describe('numbers the columns cannot hold', () => {
  // BUG (Low; lib/component-fields.ts:32-37 nonNegative() and
  // app/api/cases/[caseId]/scale/route.ts:47 accept any finite number): the
  // DECIMAL(15,6) quantity column refuses 1e20 and the routes answer 500.
  it.fails('component quantity 1e20 and scale to 1e300 -> 400 (500 today)', async () => {
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

  // BUG (Low; app/api/cases/[caseId]/scale/route.ts:46-47 checks `t > 0`,
  // which Infinity passes): JSON 1e309 parses to Infinity, the product
  // quantity UPDATE fails and the route answers 500 instead of 400.
  it.fails('scale to a non-finite amount (1e309) -> 400 (500 today)', async () => {
    const scale = await api.post(`/api/cases/${w.P.base.id}/scale`, { token: w.users.owner.token, raw: '{"from":1,"to":1e309,"mode":"data-covers"}' });
    expect(scale.status).toBe(400);
  });
});
