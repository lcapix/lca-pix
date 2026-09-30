/**
 * Error leakage (L1): force a database failure behind every route and check
 * that the 5xx body carries no internal detail (SQL, error codes, host
 * names, stack frames: the LEAK_PATTERNS of support/http.ts).
 *
 * The one mock in this suite besides outbound network: '@/lib/db-helpers'
 * is wrapped so that, while `failing.on`, every query except the token check
 * throws an error shaped like a mysql2 error whose message holds SQL text and
 * a host name. The world is built with the real functions first.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { sqlOne } from '../support/db';
import { call, findLeak } from '../support/http';
import { loadHandler } from '../support/routes';
import { buildRowRequest, isPublic, loadPermissions, type PermissionRow } from '../support/permissions';
import { buildWorld, type Caller, type World } from '../support/world';

// on: every query fails. onlyTransaction: only transaction() fails, so a route
// gets as far as its transaction (the assessment engine's failure path).
const failing = vi.hoisted(() => ({ on: false, onlyTransaction: false }));

vi.mock('@/lib/db-helpers', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/db-helpers')>();
  const boom = () => {
    const e: any = new Error(
      "Deadlock found when trying to get lock; try restarting transaction: SELECT password_hash FROM account WHERE id = 1 (mysql 8.0 at lca-prod.cmp8.us-east-1.rds.amazonaws.com)",
    );
    e.code = 'ER_LOCK_DEADLOCK';
    e.errno = 1213;
    e.sqlState = '40001';
    e.sqlMessage = e.message;
    e.sql = 'SELECT password_hash FROM account WHERE id = 1';
    return e;
  };
  // requireAuth's own lookup keeps working, so each request reaches the route.
  const exempt = (sql: unknown) => /FROM account WHERE id = \?/.test(String(sql)) && /is_active/.test(String(sql));
  const wrap =
    <F extends (...a: any[]) => Promise<any>>(fn: F) =>
    (async (sql: string, params?: any[]) => {
      if (failing.on && !failing.onlyTransaction && !exempt(sql)) throw boom();
      return fn(sql, params);
    }) as unknown as F;
  return {
    ...real,
    query: wrap(real.query),
    queryOne: wrap(real.queryOne),
    insert: wrap(real.insert),
    execute: wrap(real.execute),
    exists: wrap(real.exists),
    count: wrap(real.count),
    transaction: (async (cb: any) => {
      if (failing.on) throw boom();
      return real.transaction(cb);
    }) as typeof real.transaction,
  };
});

const { rows } = loadPermissions();

let w: World;
beforeAll(async () => {
  w = await buildWorld();
});

function callerFor(row: PermissionRow): Caller {
  if (row.expect.padmin === 200 && row.expect.owner !== 200) return 'padmin';
  return 'owner';
}

/**
 * Routes that still put the error text in the body, each a known bug pinned
 * as it.fails. None today: the last one, POST /api/cases/:id/assessments (L1),
 * now answers a generic message with a request id and logs the detail.
 */
const LEAKS: Record<string, string> = {};

describe('no internal detail in error bodies when the database fails', () => {
  for (const row of rows.filter((r) => !isPublic(r) || r.id === 'R02' || r.id === 'R01')) {
    const test = async () => {
      const fresh: Record<string, number> = {};
      if (row.fresh) fresh[row.fresh] = await w.fresh[row.fresh]();
      const caller = callerFor(row);
      const { url, template, opts } = buildRowRequest(row, { w, caller, fresh });
      const handler = await loadHandler(template, row.method);
      failing.on = true;
      let res;
      try {
        res = await call(handler, row.method, url, { ...opts, allowLeak: true });
      } finally {
        failing.on = false;
      }
      const leak = findLeak(res.text);
      expect(leak, `${row.id} ${row.method} ${url} -> ${res.status}: ${res.text.slice(0, 200)}`).toBeNull();
      expect(res.text).not.toContain('rds.amazonaws.com');
      expect(res.text).not.toContain('Deadlock');
    };
    if (LEAKS[row.id]) it.fails(`${row.id} ${row.method} ${row.path} (${LEAKS[row.id]})`, test);
    else it(`${row.id} ${row.method} ${row.path}`, test);
  }
});

describe('a 500 names a request id that the server log also has (L1)', () => {
  const runPath = () => `/api/cases/${w.P.base.id}/assessments`;

  async function failRun(onlyTransaction: boolean) {
    const handler = await loadHandler('/api/cases/{caseId}/assessments', 'POST');
    const logged = vi.spyOn(console, 'error');
    const mark = logged.mock.calls.length;
    failing.on = true;
    failing.onlyTransaction = onlyTransaction;
    try {
      const res = await call(handler, 'POST', runPath(), {
        token: w.users.owner.token,
        json: {},
        params: { caseId: String(w.P.base.id) },
        allowLeak: true,
      });
      return { res, logs: logged.mock.calls.slice(mark) };
    } finally {
      failing.on = false;
      failing.onlyTransaction = false;
    }
  }

  it('POST /api/cases/:id/assessments, the database failing before the run', async () => {
    const { res, logs } = await failRun(false);
    expect(res.status).toBe(500);
    expect(res.json).toEqual({ error: 'Failed to run assessment', request_id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    const line = logs.find((c) => String(c[0]).includes(res.json.request_id));
    expect(line, 'the id is logged with the error').toBeDefined();
    expect(String(line![1]?.message ?? line![1])).toContain('Deadlock');
  });

  it('POST /api/cases/:id/assessments, the engine transaction failing: the failed run keeps the id, not the error', async () => {
    const { res, logs } = await failRun(true);
    expect(res.status).toBe(500);
    expect(res.json).toMatchObject({ error: 'Failed to run assessment', status: 'failed', request_id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(findLeak(res.text)).toBeNull();
    expect(logs.some((c) => String(c[0]).includes(res.json.request_id))).toBe(true);
    // The failed run is readable by every member (GET returns it): it names the request only.
    const run = await sqlOne<{ status: string; error_log: string }>('SELECT status, error_log FROM assessment_runs WHERE run_id = ?', [res.json.run_id]);
    expect(run?.status).toBe('failed');
    expect(run?.error_log).toContain(res.json.request_id);
    expect(run?.error_log).not.toMatch(/Deadlock|SELECT|rds\.amazonaws/);
  });
});
