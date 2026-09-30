/**
 * Helpers for tests/db: connections to the throwaway database, the repo's
 * db scripts run as child processes, and a schema snapshot for diffs.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { inject } from 'vitest';
import type { TestDbConfig } from './context';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const MIGRATE = path.join(ROOT, 'scripts', 'db', 'migrate.mjs');
export const FRESH = path.join(ROOT, 'scripts', 'db', 'fresh.mjs');

export function testDb(): TestDbConfig {
  return inject('testDb');
}

/** A single connection (not a pool) to the suite's database, or another lcapix_t_* one. */
export function connect(database: string = testDb().database) {
  const db = testDb();
  return mysql.createConnection({
    host: db.host,
    port: Number(db.port),
    user: db.user,
    password: db.password,
    database,
    charset: 'utf8mb4',
  });
}

/** Env for a child script: the suite's server, pointed at `database`. */
export function scriptEnv(database: string): NodeJS.ProcessEnv {
  const db = testDb();
  return {
    ...process.env,
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

/** Feed SQL text to the mysql CLI (the way migrate.mjs applies a file). */
export function mysqlCli(database: string, sql: string): RunResult {
  const db = testDb();
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (db.password) env.MYSQL_PWD = db.password;
  else delete env.MYSQL_PWD;
  const r = spawnSync(
    'mysql',
    [`--host=${db.host}`, `--port=${db.port}`, `--user=${db.user}`, '--default-character-set=utf8mb4', database],
    { input: sql, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: `${r.stdout}${r.stderr}` };
}

type Conn = Awaited<ReturnType<typeof connect>>;

export async function rows<T = any>(conn: Conn, sql: string, params: unknown[] = []): Promise<T[]> {
  const [r] = await conn.query(sql, params);
  return r as T[];
}

/**
 * Everything that makes up the schema, as sorted text lines: tables, columns,
 * indexes, foreign keys and CHECK constraints. Two databases with equal
 * snapshots have the same structure.
 */
export async function schemaSnapshot(conn: Conn, database: string) {
  const q = (sql: string) => rows<Record<string, unknown>>(conn, sql, [database]);
  const line = (r: Record<string, unknown>) => Object.values(r).map((v) => (v === null ? '<null>' : String(v))).join(' | ');
  const tables = await q(
    `SELECT TABLE_NAME, ENGINE, TABLE_COLLATION FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
  );
  const columns = await q(
    `SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLLATION_NAME
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  );
  const indexes = await q(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
  );
  const fks = await q(
    `SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME,
            rc.DELETE_RULE, rc.UPDATE_RULE
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
         ON rc.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME = k.CONSTRAINT_NAME
        AND rc.TABLE_NAME = k.TABLE_NAME
      WHERE k.TABLE_SCHEMA = ? ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
  );
  const checks = await q(
    `SELECT tc.TABLE_NAME, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
       FROM information_schema.CHECK_CONSTRAINTS cc
       JOIN information_schema.TABLE_CONSTRAINTS tc
         ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
      WHERE cc.CONSTRAINT_SCHEMA = ? ORDER BY tc.TABLE_NAME, cc.CONSTRAINT_NAME`,
  );
  return {
    tables: tables.map(line),
    columns: columns.map(line),
    indexes: indexes.map(line),
    foreignKeys: fks.map(line),
    checks: checks.map(line),
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
