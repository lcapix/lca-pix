/**
 * Direct SQL against the suite's throwaway database, for what no API does
 * (making a platform admin, deactivating an account, a legacy comparison
 * row) and for asserting side effects without going through the API under
 * test. Refuses any database whose name is not lcapix_t_* on a local host.
 */
import mysql from 'mysql2/promise';
import { inject } from 'vitest';
import '../../db/support/context';

const LOCAL = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

let conn: mysql.Connection | null = null;

export function testDbName(): string {
  const db = inject('testDb');
  if (!/^lcapix_t_[a-z0-9_]{1,55}$/.test(db.database) || !LOCAL.has(db.host.toLowerCase())) {
    throw new Error(`Refusing direct SQL on ${db.host}/${db.database}: only a local lcapix_t_* database`);
  }
  return db.database;
}

async function connection(): Promise<mysql.Connection> {
  if (conn) return conn;
  const db = inject('testDb');
  conn = await mysql.createConnection({
    host: db.host,
    port: Number(db.port),
    user: db.user,
    password: db.password,
    database: testDbName(),
    charset: 'utf8mb4',
  });
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
  const c = conn;
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
    const r = await sqlOne<{ n: number }>(`SELECT COUNT(*) AS n FROM \`${t}\``);
    out[t] = Number(r?.n ?? 0);
  }
  return out;
}

/** CHECKSUM TABLE of every writable table: equal before and after means nothing was written. */
export async function tableChecksums(): Promise<Record<string, string>> {
  const rows = await sql<{ Table: string; Checksum: string | number | null }>(
    `CHECKSUM TABLE ${WRITABLE_TABLES.map((t) => `\`${t}\``).join(', ')}`,
  );
  const out: Record<string, string> = {};
  for (const r of rows) out[String(r.Table).split('.').pop()!] = String(r.Checksum);
  return out;
}
