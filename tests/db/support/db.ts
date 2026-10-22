/**
 * Helpers for tests/db: connections to the throwaway Postgres database (they
 * answer in mysql2's shapes through lib/db's runner, as the app's do), the
 * repo's db scripts run as child processes, and a schema snapshot for diffs.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { inject } from 'vitest';
import { PG_TYPES, runner } from '@/lib/db';
import type { TestDbConfig } from './context';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const MIGRATE = path.join(ROOT, 'scripts', 'db', 'migrate.mjs');
export const FRESH = path.join(ROOT, 'scripts', 'db', 'fresh.mjs');

export function testDb(): TestDbConfig {
  return inject('testDb');
}

/** A single connection (not a pool) to the suite's database, or another lcapix_t_* one. */
export async function connect(database: string = testDb().database) {
  const db = testDb();
  const client = new pg.Client({
    host: db.host,
    port: Number(db.port),
    user: db.user,
    password: db.password || undefined,
    database,
    types: PG_TYPES,
  });
  await client.connect();
  return {
    ...runner(client),
    beginTransaction: async () => void (await client.query('BEGIN')),
    commit: async () => void (await client.query('COMMIT')),
    rollback: async () => void (await client.query('ROLLBACK')),
    // A lone client, not a pooled one: nothing to give back (end() closes it).
    release: () => {},
    end: () => client.end(),
  };
}

/** Env for a child script: the suite's server, pointed at `database`. */
export function scriptEnv(database: string): NodeJS.ProcessEnv {
  const db = testDb();
  return {
    ...process.env,
    DATABASE_URL: '',
    DATABASE_HOST: db.host,
    DATABASE_PORT: db.port,
    DATABASE_USER: db.user,
    DATABASE_PASSWORD: db.password,
    DATABASE_NAME: database,
  };
}

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  /** stdout + stderr */
  out: string;
}

export function runNode(script: string, args: string[], env: NodeJS.ProcessEnv): RunResult {
  const r = spawnSync(process.execPath, [script, ...args], {
    env,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: `${r.stdout}${r.stderr}` };
}

/** scripts/db/migrate.mjs against `database`. */
export function runMigrate(database: string, args: string[] = []) {
  return runNode(MIGRATE, args, scriptEnv(database));
}

/** A new lcapix_t_* database from scripts/db/fresh.mjs. Returns its name. */
export function createDb(args: string[] = []): string {
  const r = runNode(FRESH, args, scriptEnv(''));
  if (r.status !== 0) throw new Error(`fresh.mjs failed:\n${r.stderr}`);
  return r.stdout.trim().split('\n').pop()!.trim();
}

export function dropDb(name: string) {
  const r = runNode(FRESH, ['--drop', name], scriptEnv(''));
  if (r.status !== 0) throw new Error(`fresh.mjs --drop ${name} failed:\n${r.stderr}`);
}

/** Run a SQL file's text on `database` the way migrate.mjs applies a file (one simple query). */
export async function sqlFile(database: string, sql: string): Promise<{ ok: boolean; error: string }> {
  const db = testDb();
  const client = new pg.Client({ host: db.host, port: Number(db.port), user: db.user, password: db.password || undefined, database });
  await client.connect();
  try {
    await client.query(sql);
    return { ok: true, error: '' };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  } finally {
    await client.end();
  }
}

type Conn = Awaited<ReturnType<typeof connect>>;

export async function rows<T = any>(conn: Conn, sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await conn.query(sql, params);
  return r as T[];
}

/**
 * Everything that makes up the schema, as sorted text lines: tables, columns,
 * indexes, constraints (keys, foreign keys, checks), triggers and functions.
 * Two databases with equal snapshots have the same structure.
 */
export async function schemaSnapshot(conn: Conn) {
  const q = (sql: string) => rows<Record<string, unknown>>(conn, sql);
  const line = (r: Record<string, unknown>) => Object.values(r).map((v) => (v === null ? '<null>' : String(v))).join(' | ');
  const tables = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  const columns = await q(
    `SELECT c.table_name, c.ordinal_position, c.column_name, format_type(a.atttypid, a.atttypmod) AS type,
            c.is_nullable, c.column_default, c.is_identity, c.collation_name
       FROM information_schema.columns c
       JOIN pg_attribute a ON a.attrelid = ('public.' || quote_ident(c.table_name))::regclass AND a.attname = c.column_name
      WHERE c.table_schema = 'public' ORDER BY c.table_name, c.ordinal_position`,
  );
  const indexes = await q(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname`);
  const constraints = await q(
    `SELECT rel.relname AS table_name, con.conname, con.contype, pg_get_constraintdef(con.oid) AS def
       FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE n.nspname = 'public' ORDER BY rel.relname, con.conname`,
  );
  const triggers = await q(
    `SELECT c.relname AS table_name, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE NOT t.tgisinternal ORDER BY c.relname, t.tgname`,
  );
  const functions = await q(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' ORDER BY p.proname`,
  );
  return {
    tables: tables.map(line),
    columns: columns.map(line),
    indexes: indexes.map(line),
    constraints: constraints.map(line),
    triggers: triggers.map(line),
    functions: functions.map(line),
  };
}

/** Library rows keyed by natural key (ids differ between builds; values must not). */
export async function referenceSnapshot(conn: Conn) {
  const factors = await rows<any>(
    conn,
    `SELECT s.substance_name, ic.category_name, d.method_name, d.geographic_scope,
            CAST(d.factor_value AS CHAR) AS factor_value, d.unit, d.factor_basis, d.source_reference
       FROM driver_impact_factors d
       JOIN substances s ON s.substance_id = d.substance_id
       JOIN impact_categories ic ON ic.category_id = d.category_id`,
  );
  const substances = await rows<any>(
    conn,
    `SELECT s.substance_name, s.unit, s.category, s.cas_number, p.substance_name AS variant_of, s.variant_label, s.is_custom
       FROM substances s LEFT JOIN substances p ON p.substance_id = s.variant_of`,
  );
  const templates = await rows<any>(
    conn,
    `SELECT t.template_name, t.driver_unit, f.sort_order, f.unit, s.substance_name, f.substance_hint, CAST(f.amount_per_driver AS CHAR) AS amount
       FROM process_templates t
       LEFT JOIN process_template_flows f ON f.template_id = t.template_id
       LEFT JOIN substances s ON s.substance_id = f.substance_id`,
  );
  const vintage = await rows<any>(conn, `SELECT method_name, factor_group, gwp_vintage, evidence FROM lcia_gwp_vintage`);
  const key = (r: Record<string, unknown>) => JSON.stringify(Object.values(r));
  return {
    factors: new Map(factors.map((f) => [`${f.substance_name} | ${f.category_name} | ${f.method_name} | ${f.geographic_scope}`, f])),
    substances: substances.map(key).sort(),
    templates: templates.map(key).sort(),
    vintage: vintage.map(key).sort(),
  };
}
