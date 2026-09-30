/**
 * SQL-injection and junk-input fuzz over every path parameter (from the
 * permissions matrix) and every query parameter the routes read.
 *
 * Each payload must get a 4xx (or, for an owner's read whose payload starts
 * with the real id, the same 200 the id gets: routes parse ids with
 * parseInt, which is lenient but never reaches SQL as text). Never a 5xx,
 * never internal detail in the body (the call() scan), and the database is
 * unchanged: row counts of every writable table are equal before and after.
 * Writes are fuzzed as a non-member, so a lenient parse cannot legitimately
 * change anything either.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { call } from '../support/http';
import { rowCounts, sql } from '../support/db';
import { loadHandler, pathParams } from '../support/routes';
import { loadPermissions, buildRowRequest } from '../support/permissions';
import { buildWorld, type World } from '../support/world';

export const PAYLOADS = [
  '1 OR 1=1',
  "1' OR '1'='1",
  "'; DROP TABLE project; --",
  '1; DROP TABLE account',
  '1e309',
  '-1',
  '0',
  '99999999999999999999999',
  'abc',
  'NaN',
  'Infinity',
  '0x1F',
  '1.5',
  ' 7',
  '１２',
  '٣',
  '💥',
  '%00',
  "1 UNION SELECT password_hash FROM account",
  '1)) OR SLEEP(3)#',
  '[1]',
  '{"$gt":0}',
  'null',
  '',
];

// own_cases rows repeat base rows' routes with a project setting that only
// changes which member gets 404; the handlers and ids here are the same.
const rows = loadPermissions().rows.filter((r) => !r.own_cases);
const pathRows = rows.filter((r) => pathParams(r.path).length > 0);

let w: World;
let before: Record<string, number>;
beforeAll(async () => {
  w = await buildWorld();
  before = await rowCounts();
});

// Ids are parsed strictly (lib/ids.ts): only the exact clean id may reach the
// resource. Before, parseInt/Number accepted '31abc', ' 31' and '0x1F' as 31.
function allowed(status: number, owner: boolean, payload: string, method: string, cleanValue: string) {
  if (status >= 500) return false;
  if (owner && method === 'GET' && status === 200) return payload === cleanValue;
  return [400, 404].includes(status);
}

// Other spellings of the real id. Every one must miss, whatever the id is,
// so the check doesn't depend on a project happening to have id 31 (= 0x1F).
function aliasesOf(clean: string): string[] {
  const n = Number(clean);
  return [`0x${n.toString(16)}`, `0X${n.toString(16).toUpperCase()}`, `${clean}abc`, ` ${clean}`, `${clean} `, `+${clean}`,
    `0${clean}`, `${clean}.0`, `${clean}e0`, `${n / 10}e1`, `${clean}%00`];
}

describe('fuzz: path parameters', () => {
  for (const row of pathRows) {
    const params = pathParams(row.path);
    for (const param of params) {
      const caller = row.method === 'GET' ? 'owner' : 'nonmem';
      it(`${row.id} ${row.method} ${row.path} {${param}} as ${caller}`, async () => {
        const fresh: Record<string, number> = {};
        const base = buildRowRequest(row, { w, caller, fresh: new Proxy(fresh, { get: () => w.P.base.id }) });
        const handler = await loadHandler(base.template, row.method);
        const cleanValue = base.opts.params![param];
        // Control: the clean request reaches the resource (owner read 200, non-member 404).
        const control = await call(handler, row.method, base.url, base.opts);
        expect(control.status, `${row.id} control: ${control.text.slice(0, 120)}`).toBe(caller === 'owner' ? 200 : 404);
        for (const payload of [...PAYLOADS, ...aliasesOf(String(cleanValue))]) {
          const value = payload.replace(/^1(?=\D|$)/, cleanValue);
          const url = base.url.replace(`/${cleanValue}`, `/${encodeURIComponent(value)}`);
          const res = await call(handler, row.method, url, { ...base.opts, params: { ...base.opts.params, [param]: value } });
          expect(allowed(res.status, caller === 'owner', value, row.method, String(cleanValue)), `${row.id} ${param}=${JSON.stringify(value)} -> ${res.status} ${res.text.slice(0, 160)}`).toBe(true);
        }
      });
    }
  }
});

describe('fuzz: query parameters', () => {
  const targets = (): Array<{ name: string; method: string; url: (p: string) => string; token: () => string | null }> => [
    { name: 'compare ?cases', method: 'GET', url: (p) => `/api/projects/${w.P.id}/compare?cases=${p}`, token: () => w.users.viewer.token },
    { name: 'compare ?runs', method: 'GET', url: (p) => `/api/projects/${w.P.id}/compare?cases=${w.P.base.id}&runs=${p}`, token: () => w.users.viewer.token },
    { name: 'compare ?base', method: 'GET', url: (p) => `/api/projects/${w.P.id}/compare?cases=${w.P.base.id},${w.P.comp.id}&base=${p}`, token: () => w.users.viewer.token },
    { name: 'export ?format', method: 'GET', url: (p) => `/api/assessments/${w.P.base.run}/export?format=${p}`, token: () => w.users.viewer.token },
    { name: 'documents ?id', method: 'GET', url: (p) => `/api/cases/${w.P.base.id}/documents?id=${p}`, token: () => w.users.owner.token },
    { name: 'documents DELETE ?id', method: 'DELETE', url: (p) => `/api/cases/${w.P.base.id}/documents?id=${p}`, token: () => w.users.owner.token },
    { name: 'members DELETE ?user_id', method: 'DELETE', url: (p) => `/api/projects/${w.P.id}/members?user_id=${p}`, token: () => w.users.owner.token },
    { name: 'component DELETE ?children', method: 'DELETE', url: (p) => `/api/components/${w.P.base.task}?children=${p}`, token: () => w.users.owner.token },
    { name: 'integrations log ?limit', method: 'GET', url: (p) => `/api/integrations/log?limit=${p}`, token: () => w.users.padmin.token },
    { name: 'integrations log ?source', method: 'GET', url: (p) => `/api/integrations/log?source=${p}`, token: () => w.users.padmin.token },
    { name: 'driver-factors ?category_id', method: 'GET', url: (p) => `/api/driver-factors?category_id=${p}`, token: () => w.users.nonmem.token },
    { name: 'driver-factors ?substance_id', method: 'GET', url: (p) => `/api/driver-factors?substance_id=${p}`, token: () => w.users.nonmem.token },
    { name: 'driver-factors ?driver_name', method: 'GET', url: (p) => `/api/driver-factors?driver_name=${p}`, token: () => w.users.nonmem.token },
    { name: 'substances ?category', method: 'GET', url: (p) => `/api/substances?category=${p}`, token: () => w.users.nonmem.token },
    { name: 'legacy comparisons ?project_id', method: 'GET', url: (p) => `/api/comparisons?project_id=${p}`, token: () => w.users.viewer.token },
    { name: 'google ?code&state', method: 'GET', url: (p) => `/api/auth/google?code=${p}&state=${p}`, token: () => null },
  ];

  for (const t of targets()) {
    it(t.name, async () => {
      for (const payload of PAYLOADS) {
        const url = t.url(encodeURIComponent(payload));
        const r = t.method === 'GET' ? await api.get(url, { token: t.token() }) : await api.delete(url, { token: t.token() });
        expect(r.status, `${t.name}=${JSON.stringify(payload)}: ${r.text.slice(0, 160)}`).toBeLessThan(500);
        expect(r.text).not.toContain('password_hash');
      }
    });
  }
});

describe('fuzz leaves the database unchanged', () => {
  it('row counts of every writable table are equal before and after', async () => {
    expect(await rowCounts()).toEqual(before);
    // The tables the payloads name still exist and still hold their rows.
    expect((await sql('SELECT COUNT(*) AS n FROM project'))[0].n).toBeGreaterThan(0);
    expect((await sql('SELECT COUNT(*) AS n FROM account'))[0].n).toBeGreaterThan(0);
  });
});
