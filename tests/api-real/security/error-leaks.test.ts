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
import { call, findLeak } from '../support/http';
import { loadHandler } from '../support/routes';
import { buildRowRequest, isPublic, loadPermissions, type PermissionRow } from '../support/permissions';
import { buildWorld, type Caller, type World } from '../support/world';

const failing = vi.hoisted(() => ({ on: false }));

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
      if (failing.on && !exempt(sql)) throw boom();
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

// own_cases rows repeat base rows' routes with a project setting that only
// changes which member gets 404; the handlers and ids here are the same.
const rows = loadPermissions().rows.filter((r) => !r.own_cases);

let w: World;
beforeAll(async () => {
  w = await buildWorld();
});

function callerFor(row: PermissionRow): Caller {
  if (row.expect.padmin === 200 && row.expect.owner !== 200) return 'padmin';
  return 'owner';
}

/**
 * Routes that still put the error text in the body. Each is a real bug:
 *  - POST /api/cases/:id/assessments (L1): app/api/cases/[caseId]/assessments/route.ts
 *    returns `details: error.message` from its outer catch (:525) and from the
 *    engine-failure branch (:462).
 */
const LEAKS: Record<string, string> = {
  R23: 'L1: app/api/cases/[caseId]/assessments/route.ts:525 returns details: error.message',
};

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
