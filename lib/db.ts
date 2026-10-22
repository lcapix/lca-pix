/**
 * Database connection pool (Postgres via pg), in the shape the app was
 * written for: mysql2's promise pool. `pool.execute(sql, params)` and
 * `pool.query(...)` resolve to [rows, fields] for a SELECT and to
 * [{ insertId, affectedRows }, []] for a write; `pool.getConnection()` gives
 * a connection with beginTransaction / commit / rollback / release. The SQL
 * and the errors are translated by lib/db-dialect.ts. Rows come back as
 * mysql2 gave them: counts as numbers, decimals as strings, true/false as 1/0.
 *
 * Every connection setting comes from the environment. There are no host,
 * user, password or database fallbacks: a missing variable is a
 * configuration error, reported by name on the first query. The pool is
 * created lazily on first use, so importing this module (for example during
 * `next build`, or from a test) never opens a connection.
 *
 * Either: DATABASE_URL            a postgres:// connection string, as Neon and
 *                                 other hosts give it. Its sslmode applies; a
 *                                 remote one without sslmode gets TLS with
 *                                 certificate checks (never a plain connection)
 * Or:     DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME
 *         (DATABASE_PASSWORD may be empty for a local user, but it must be set)
 *         DATABASE_PORT (default 5432)
 *         DATABASE_SSL=true      turn on TLS with certificate verification
 *         DATABASE_SSL_CA=...    CA bundle for TLS: a file path, or the PEM
 *                                text itself. Without it, Node's default
 *                                trust store is used.
 */

import fs from 'node:fs';
import pg from 'pg';
import { asMysqlError, toPgParams, toPgSql } from './db-dialect';

const REQUIRED_ENV = ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'] as const;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

/** A row as the app reads it (mysql2's RowDataPacket). */
export type RowDataPacket = Record<string, any>;
/** What a write resolves to (mysql2's ResultSetHeader). */
export interface ResultSetHeader {
  insertId: number;
  affectedRows: number;
  changedRows: number;
  warningStatus: number;
}
export interface FieldPacket {
  name: string;
}
export interface Runner {
  execute<T = any>(sql: string, params?: readonly unknown[]): Promise<[T, FieldPacket[]]>;
  query<T = any>(sql: string, params?: readonly unknown[]): Promise<[T, FieldPacket[]]>;
}
export interface PoolConnection extends Runner {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
}
export type Connection = PoolConnection;
export interface Pool extends Runner {
  getConnection(): Promise<PoolConnection>;
  end(): Promise<void>;
}

function readSslOptions(env: NodeJS.ProcessEnv): pg.PoolConfig['ssl'] {
  if ((env.DATABASE_SSL ?? '').toLowerCase() !== 'true') return undefined;
  const caSetting = env.DATABASE_SSL_CA?.trim();
  if (!caSetting) return { rejectUnauthorized: true };
  if (caSetting.startsWith('-----BEGIN')) return { rejectUnauthorized: true, ca: caSetting };
  try {
    return { rejectUnauthorized: true, ca: fs.readFileSync(caSetting, 'utf8') };
  } catch (err) {
    throw new DatabaseConfigError(
      `DATABASE_SSL_CA points to a file that cannot be read (${(err as NodeJS.ErrnoException).code ?? 'error'}). ` +
        'Set it to the path of a PEM CA bundle, or to the PEM text itself.',
    );
  }
}

// Rows as mysql2 returned them: a count (int8) is a number, a comparison
// (boolean) is 1 or 0. Decimals stay strings, as mysql2 left them.
const INT8 = 20;
const BOOL = 16;
export const PG_TYPES = {
  getTypeParser(oid: number, format?: any) {
    if (oid === INT8) return (v: string) => Number(v);
    if (oid === BOOL) return (v: string) => (v === 't' ? 1 : 0);
    return pg.types.getTypeParser(oid, format);
  },
} as pg.CustomTypesConfig;

/** Builds pool options from the environment, or throws naming what is missing. */
export function dbConfigFromEnv(env: NodeJS.ProcessEnv = process.env): pg.PoolConfig {
  const common = { types: PG_TYPES, max: 10, idleTimeoutMillis: 60_000, keepAlive: true };
  if (env.DATABASE_URL) {
    let remoteWithoutSslmode = false;
    try {
      const u = new URL(env.DATABASE_URL);
      remoteWithoutSslmode = !LOCAL_HOSTS.has(u.hostname.toLowerCase()) && !u.searchParams.has('sslmode') && !u.searchParams.has('ssl');
    } catch {
      throw new DatabaseConfigError('DATABASE_URL is not a valid connection string.');
    }
    return { ...common, connectionString: env.DATABASE_URL, ...(remoteWithoutSslmode ? { ssl: { rejectUnauthorized: true } } : {}) };
  }

  const missing = REQUIRED_ENV.filter((name) =>
    name === 'DATABASE_PASSWORD' ? env[name] === undefined : !env[name],
  );
  if (missing.length > 0) {
    throw new DatabaseConfigError(
      `Database is not configured: missing ${missing.join(', ')}. ` +
        'Set DATABASE_URL, or these, in .env.local for development (see .env.local.example) ' +
        'or in the deployment environment (e.g. Vercel project env vars).',
    );
  }

  const port = Number.parseInt(env.DATABASE_PORT || '5432', 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new DatabaseConfigError('DATABASE_PORT must be a positive integer.');
  }

  return {
    ...common,
    host: env.DATABASE_HOST,
    port,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    ssl: readSslOptions(env),
  };
}

/** Runs one statement on a pool or a client, in mysql2's result shape. */
async function run(client: pg.Pool | pg.PoolClient | pg.Client, sql: string, params?: readonly unknown[]): Promise<[any, FieldPacket[]]> {
  const { text, returning } = toPgSql(sql);
  let res: pg.QueryResult;
  try {
    res = await client.query({ text, values: toPgParams(params) });
  } catch (err) {
    throw asMysqlError(err);
  }
  if (res.command === 'INSERT' || res.command === 'UPDATE' || res.command === 'DELETE') {
    const header: ResultSetHeader = {
      insertId: returning && res.rows[0] ? Number(res.rows[0][returning]) : 0,
      affectedRows: res.rowCount ?? 0,
      changedRows: res.rowCount ?? 0,
      warningStatus: 0,
    };
    return [header, []];
  }
  return [res.rows, (res.fields ?? []).map((f) => ({ name: f.name }))];
}

/**
 * A pg client (or pool) that answers as a mysql2 connection does, for
 * scripts and tests that open their own connection. Give the client
 * `types: PG_TYPES` so rows read as the app reads them.
 */
export function runner(client: pg.Pool | pg.PoolClient | pg.Client): Runner {
  return {
    execute: (sql, params) => run(client, sql, params),
    query: (sql, params) => run(client, sql, params),
  };
}

function wrapPool(p: pg.Pool): Pool {
  return {
    execute: (sql, params) => run(p, sql, params),
    query: (sql, params) => run(p, sql, params),
    async getConnection() {
      const client = await p.connect();
      return {
        execute: (sql, params) => run(client, sql, params),
        query: (sql, params) => run(client, sql, params),
        beginTransaction: async () => void (await run(client, 'BEGIN')),
        commit: async () => void (await run(client, 'COMMIT')),
        rollback: async () => void (await run(client, 'ROLLBACK')),
        release: () => client.release(),
      };
    },
    end: () => p.end(),
  };
}

// In `next dev`, modules are re-evaluated on every hot reload. Keep one pool
// per process there so reloads do not leak connections.
const globalForDb = globalThis as typeof globalThis & { __lcapixDbPool?: Pool };
let realPool: Pool | undefined =
  process.env.NODE_ENV === 'development' ? globalForDb.__lcapixDbPool : undefined;

/** Returns the shared pool, creating it on first call. Throws if env is incomplete. */
export function getPool(): Pool {
  if (!realPool) {
    realPool = wrapPool(new pg.Pool(dbConfigFromEnv()));
    if (process.env.NODE_ENV === 'development') globalForDb.__lcapixDbPool = realPool;
  }
  return realPool;
}

/** Closes the pool if one was created (scripts and tests). */
export async function closePool(): Promise<void> {
  const p = realPool;
  realPool = undefined;
  if (globalForDb.__lcapixDbPool === p) globalForDb.__lcapixDbPool = undefined;
  if (p) await p.end();
}

/**
 * The default export behaves like the pool (`pool.execute`, `pool.query`,
 * `pool.getConnection`, ...). It creates the real pool on the first property
 * access, so existing `import pool from '@/lib/db'` code keeps working.
 */
const pool: Pool = new Proxy({} as Pool, {
  get(_target, prop) {
    // Never create the pool just because something checked for a thenable
    // or inspected the object (await, console.log, test automocks).
    if (prop === 'then') return undefined;
    if (typeof prop === 'symbol' && !realPool) return undefined;
    const target = getPool();
    const value = Reflect.get(target, prop, target);
    return typeof value === 'function' ? value.bind(target) : value;
  },
  has(_target, prop) {
    return prop in getPool();
  },
});

export default pool;
