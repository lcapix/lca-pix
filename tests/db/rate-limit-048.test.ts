/**
 * migrate-048: rate-limit counts in the database, shared by every server. Two
 * stores (two servers) count against one row; a new window starts again; the
 * migration runs twice without change.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../../scripts/db/migrate.mjs';
import { PostgresRateLimitStore } from '@/lib/rate-limit';
import { connect, rows } from './support/db';

let conn: Awaited<ReturnType<typeof connect>>;
const policy = { id: 'test-shared', limit: 3, windowMs: 60_000 };
const NOW = 1_800_000_000_000;

beforeAll(async () => {
  conn = await connect();
});
afterAll(async () => {
  await conn?.end();
});

describe('PostgresRateLimitStore (migrate-048)', () => {
  it('two servers count against the same row, and the fourth hit is refused', async () => {
    const a = new PostgresRateLimitStore((sql, params) => rows(conn, sql, params));
    const b = new PostgresRateLimitStore((sql, params) => rows(conn, sql, params));
    const key = `test-shared:user:${NOW}`;
    expect((await a.hit(key, policy, NOW)).remaining).toBe(2);
    expect((await b.hit(key, policy, NOW + 1)).remaining).toBe(1);
    expect((await a.hit(key, policy, NOW + 2)).allowed).toBe(true);
    const fourth = await b.hit(key, policy, NOW + 3);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
    expect((await a.peek!(key, policy, NOW + 4)).remaining).toBe(0);
    expect((await a.hit(key, policy, NOW + policy.windowMs)).remaining).toBe(2);
  });

  it('the migration runs a second time without change', async () => {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, 'migrate-048-rate-limit-hits.sql'), 'utf8');
    await conn.query(sql);
    const cols = await rows<{ column_name: string }>(conn, `SELECT column_name FROM information_schema.columns WHERE table_name = 'rate_limit_hits' ORDER BY ordinal_position`);
    expect(cols.map((c) => c.column_name)).toEqual(['bucket', 'window_no', 'hits', 'expires_at']);
  });
});
