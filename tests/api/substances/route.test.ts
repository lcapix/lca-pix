import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/substances/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

const VALID = {
  name: 'Cork granulate',
  kind: 'input',
  unit: 'kg',
  method: 'CML 2001',
  impactCategory: 'Global Warming',
  factorValue: 0.35,
  source: 'Supplier EPD 2025',
};

function post(body: any) {
  return POST(new Request('http://t/api/substances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  }) as any);
}

/** A transaction() that runs the callback on a fake connection, rethrowing like the real one. */
function fakeTransaction(execute: (sql: string, params: any[]) => any) {
  const conn = { execute: vi.fn(async (sql: string, params: any[]) => execute(sql, params)) };
  vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn));
  return conn;
}

describe('POST /api/substances', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(auth.requireAuth).mockResolvedValue(42);
  });

  it('checks for duplicates only among library rows and the caller\'s own', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce(null).mockResolvedValueOnce({ category_id: 1 } as any);
    fakeTransaction(async (sql) => [{ insertId: 900, affectedRows: 1 }]);
    vi.mocked(db.queryOne).mockResolvedValueOnce({ substance_id: 900, substance_name: 'Cork granulate' } as any);

    await post(VALID);
    const [sql, params] = vi.mocked(db.queryOne).mock.calls[0];
    expect(sql).toMatch(/is_custom = 0 OR created_by = \?/);
    expect(params).toContain(42);
  });

  it('409 for a library duplicate names the visible row', async () => {
    vi.mocked(db.queryOne).mockResolvedValueOnce({ substance_id: 3, substance_name: 'Cork granulate' } as any);
    const res = await post(VALID);
    expect(res.status).toBe(409);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("409 without another user's name or id when only their private row collides", async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce(null)                       // nothing visible to the caller
      .mockResolvedValueOnce({ category_id: 1 } as any); // impact category
    fakeTransaction(async (sql) => {
      if (/INSERT INTO substances/.test(sql)) {
        throw Object.assign(new Error("Duplicate entry 'Cork granulate' for key 'substances.substance_name'"), { code: 'ER_DUP_ENTRY' });
      }
      return [{ insertId: 1, affectedRows: 1 }];
    });

    const res = await post(VALID);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.substance_id).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/Duplicate entry|substances\.substance_name/);
  });

  it('inserts the substance and its factor in one transaction', async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ category_id: 1 } as any)
      .mockResolvedValueOnce({ substance_id: 900, substance_name: 'Cork granulate' } as any);
    const conn = fakeTransaction(async () => [{ insertId: 900, affectedRows: 1 }]);

    const res = await post(VALID);
    expect(res.status).toBe(201);
    expect(db.transaction).toHaveBeenCalledOnce();
    const sqls = conn.execute.mock.calls.map(([sql]) => sql);
    expect(sqls.some((s) => /INSERT INTO substances/.test(s))).toBe(true);
    expect(sqls.some((s) => /INSERT INTO driver_impact_factors/.test(s))).toBe(true);
    // the factor row points at the new substance
    const factorCall = conn.execute.mock.calls.find(([sql]) => /INSERT INTO driver_impact_factors/.test(sql))!;
    expect(factorCall[1][0]).toBe(900);
    // nothing written outside the transaction
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('a failed factor insert fails the request (the transaction rolls back the substance)', async () => {
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ category_id: 1 } as any);
    fakeTransaction(async (sql) => {
      if (/INSERT INTO driver_impact_factors/.test(sql)) throw new Error('ER_LOCK_WAIT_TIMEOUT');
      return [{ insertId: 900, affectedRows: 1 }];
    });

    const res = await post(VALID);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('ER_LOCK_WAIT_TIMEOUT');
    expect(db.insert).not.toHaveBeenCalled();
  });
});
