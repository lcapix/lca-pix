/**
 * The authorization matrix, generated from docs/flows/flows.yaml
 * `permissions:` and run against the real database: every route x method x
 * role (anon, nonmem, viewer, editor, adminm, owner, padmin), plus a
 * deactivated account, a revoked token (password hash changed after it was
 * issued) and a token signed with the wrong secret on every row that needs a
 * sign-in.
 *
 * Per cell:
 *   - the status is exactly the one in the row;
 *   - a 404 for a non-member is byte-identical to the 404 the same caller
 *     gets for an id that does not exist (the id reveals nothing);
 *   - a refused write (4xx on POST/PUT/DELETE) leaves every writable table's
 *     CHECKSUM unchanged.
 * A cell whose `now` differs from `expect` is a known bug: it runs as
 * it.fails naming the bug, so the suite goes red when the fix lands.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { call, setCookies } from '../support/http';
import { loadHandler } from '../support/routes';
import { tableChecksums } from '../support/db';
import { buildRowRequest, isPublic, loadPermissions, type PermissionRow } from '../support/permissions';
import { buildWorld, ROLES, type Caller, type World } from '../support/world';

const { rows, authFailures } = loadPermissions();

let w: World;
beforeAll(async () => {
  w = await buildWorld();
});

function cellsOf(row: PermissionRow): Array<[Caller, number]> {
  const cells: Array<[Caller, number]> = ROLES.map((r) => [r, row.expect[r]]);
  const extras = isPublic(row) ? { ...(row.callers ?? {}) } : { ...authFailures, ...(row.callers ?? {}) };
  for (const [c, s] of Object.entries(extras)) cells.push([c as Caller, s]);
  return cells;
}

async function withEnv<T>(env: Record<string, string> | undefined, fn: () => Promise<T>): Promise<T> {
  if (!env) return fn();
  const before = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function runCell(row: PermissionRow, caller: Caller, expected: number) {
  const fresh: Record<string, number> = {};
  if (row.fresh) fresh[row.fresh] = await w.fresh[row.fresh]();
  const { url, template, opts } = buildRowRequest(row, { w, caller, fresh });
  const handler = await loadHandler(template, row.method);
  const isWrite = row.method !== 'GET';
  const before = isWrite && expected >= 400 ? await tableChecksums() : null;

  const res = await withEnv(row.env, () => call(handler, row.method, url, opts));
  expect(res.status, `${row.id} ${row.method} ${url} as ${caller}: ${res.text.slice(0, 300)}`).toBe(expected);

  if (before) {
    expect(await tableChecksums(), `${row.id}: a refused ${row.method} must not write`).toEqual(before);
  }

  // A non-member's 404 says exactly what a missing id says.
  if (expected === 404 && row.not_found) {
    expect(res.json).toEqual({ error: row.not_found });
    const twin = buildRowRequest(row, { w, caller, fresh, missing: true });
    const missing = await withEnv(row.env, () => call(handler, row.method, twin.url, twin.opts));
    expect(missing.status, `${row.id}: missing-id twin`).toBe(404);
    expect(missing.text, `${row.id}: 404 body for a non-member vs a missing id`).toBe(res.text);
  }

  // Row-specific assertions on the success path.
  if (row.id === 'R07' && res.status === 200) {
    const ids = (res.json.projects as any[]).map((p) => Number(p.project_id));
    if (caller === 'nonmem' || caller === 'padmin') expect(ids).not.toContain(w.P.id);
    else expect(ids).toContain(w.P.id);
  }
  if ((row.id === 'R47' || row.id === 'R49') && res.status === 200) {
    expect(res.text).not.toContain(w.Q.substanceName);
    expect(res.text).not.toMatch(/QUARANTINE/);
  }
  if (row.id === 'R03') {
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin).toBe('https://accounts.google.com');
    expect(loc.searchParams.get('state')).toMatch(/^[\w-]{32,}$/);
    expect(loc.searchParams.get('code_challenge_method')).toBe('S256');
    expect(loc.searchParams.has('access_type')).toBe(false);
  }
  if (row.id === 'R03b') {
    expect(new URL(res.headers.get('location')!).searchParams.get('error')).toBe('oauth_state_mismatch');
    expect(setCookies(res.headers).auth_token).toBeUndefined();
  }
  if (row.id === 'R63') {
    const c = setCookies(res.headers);
    for (const name of ['auth_token', 'user_data']) {
      expect(c[name]?.attrs).toMatch(/max-age=0/);
      expect(c[name]?.attrs).toMatch(/httponly/);
      expect(c[name]?.attrs).toMatch(/samesite=lax/);
    }
  }
}

describe('permissions matrix (docs/flows/flows.yaml)', () => {
  it('has 69 rows covering 66 route x method pairs', () => {
    expect(rows).toHaveLength(69);
    expect(new Set(rows.map((r) => `${r.method} ${r.path.split('?')[0]}`)).size).toBe(66);
  });

  for (const row of rows) {
    describe(`${row.id} ${row.method} ${row.path}`, () => {
      for (const [caller, expected] of cellsOf(row)) {
        const now = row.now?.[caller];
        if (now !== undefined && now !== expected) {
          it.fails(`${caller} -> ${expected} (now ${now}; ${row.bug ?? 'known bug'})`, () => runCell(row, caller, expected));
        } else {
          it(`${caller} -> ${expected}`, () => runCell(row, caller, expected));
        }
      }
    });
  }
});
