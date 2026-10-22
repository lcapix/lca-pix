/**
 * Direct SQL against the suite's throwaway database, for what no API does
 * (making a platform admin, deactivating an account, a legacy comparison
 * row) and for asserting side effects without going through the API under
 * test. Refuses any database whose name is not lcapix_t_* on a local host.
 */
import pg from 'pg';
import { inject } from 'vitest';
import { PG_TYPES, runner, type Runner } from '@/lib/db';
import '../../db/support/context';

const LOCAL = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

let client: pg.Client | null = null;
let conn: Runner | null = null;

export function testDbName(): string {
  const db = inject('testDb');
  if (!/^lcapix_t_[a-z0-9_]{1,55}$/.test(db.database) || !LOCAL.has(db.host.toLowerCase())) {
    throw new Error(`Refusing direct SQL on ${db.host}/${db.database}: only a local lcapix_t_* database`);
  }
  return db.database;
}

/** One connection for the file, answering as the app's do (lib/db's runner: `?` placeholders, mysql2 shapes). */
async function connection(): Promise<Runner> {
  if (conn) return conn;
  const db = inject('testDb');
  client = new pg.Client({
    host: db.host,
    port: Number(db.port),
    user: db.user,
    password: db.password || undefined,
    database: testDbName(),
    types: PG_TYPES,
  });
  await client.connect();
  conn = runner(client);
  return conn;
}

export async function sql<T = any>(query: string, params: unknown[] = []): Promise<T[]> {
  const c = await connection();
  const [rows] = await c.query(query, params);
  return rows as T[];
}

export async function sqlOne<T = any>(query: string, params: unknown[] = []): Promise<T | undefined> {
  return (await sql<T>(query, params))[0];
}

export async function closeSql(): Promise<void> {
  const c = client;
  client = null;
  conn = null;
  if (c) await c.end();
}

/** Tables that hold tenant data or anything a request could write. */
export const WRITABLE_TABLES = [
  'account',
  'project',
  'project_members',
  'case_table',
  'component',
  'flows',
  'assessment_runs',
  'assessment_results',
  'case_documents',
  'comparison_runs',
  'substances',
  'driver_impact_factors',
  'cost_rates',
  'integration_log',
] as const;

/** Row count per writable table. */
export async function rowCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of WRITABLE_TABLES) {
    const r = await sqlOne<{ n: number }>(`SELECT COUNT(*) AS n FROM "${t}"`);
    out[t] = Number(r?.n ?? 0);
  }
  return out;
}

/**
 * A fingerprint of every writable table (md5 over every row's text, in a fixed
 * order; Postgres's stand-in for MySQL's CHECKSUM TABLE): equal before and
 * after means nothing was written.
 */
export async function tableChecksums(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const t of WRITABLE_TABLES) {
    const r = await sqlOne<{ h: string | null }>(`SELECT md5(string_agg(x::text, '|' ORDER BY x::text COLLATE "C")) AS h FROM "${t}" x`);
    out[t] = String(r?.h ?? '');
  }
  return out;
}

/** A run's frozen snapshot (JSON columns come back parsed). */
export async function snapshotOf(runId: number): Promise<any> {
  const row = await sqlOne<{ run_snapshot: unknown }>('SELECT run_snapshot FROM assessment_runs WHERE run_id = ?', [runId]);
  const v = row?.run_snapshot;
  return typeof v === 'string' ? JSON.parse(v) : v;
}
