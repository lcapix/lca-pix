/**
 * Database connection pool (MySQL via mysql2).
 *
 * Every connection setting comes from the environment. There are no host,
 * user, password or database fallbacks: a missing variable is a
 * configuration error, reported by name on the first query. The pool is
 * created lazily on first use, so importing this module (for example during
 * `next build`, or from a test) never opens a connection.
 *
 * Required: DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME
 *           (DATABASE_PASSWORD may be empty for a local root user, but it
 *           must be set)
 * Optional: DATABASE_PORT (default 3306)
 *           DATABASE_SSL=true      turn on TLS with certificate verification
 *           DATABASE_SSL_CA=...    CA bundle for TLS: a file path, or the PEM
 *                                  text itself. For AWS RDS use the RDS global
 *                                  bundle. Without it, Node's default trust
 *                                  store is used.
 */

import fs from 'node:fs';
import mysql, { type Pool, type PoolOptions } from 'mysql2/promise';

const REQUIRED_ENV = ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'] as const;

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

function readSslOptions(env: NodeJS.ProcessEnv): PoolOptions['ssl'] {
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

/** Builds pool options from the environment, or throws naming what is missing. */
export function dbConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PoolOptions {
  const missing = REQUIRED_ENV.filter((name) =>
    name === 'DATABASE_PASSWORD' ? env[name] === undefined : !env[name],
  );
  if (missing.length > 0) {
    throw new DatabaseConfigError(
      `Database is not configured: missing ${missing.join(', ')}. ` +
        'Set them in .env.local for development (see .env.local.example) ' +
        'or in the deployment environment (e.g. Vercel project env vars).',
    );
  }

  const port = Number.parseInt(env.DATABASE_PORT || '3306', 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new DatabaseConfigError('DATABASE_PORT must be a positive integer.');
  }

  return {
    host: env.DATABASE_HOST,
    port,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    ssl: readSslOptions(env),
    waitForConnections: true,
    connectionLimit: 20, // headroom for dev-server hot reloads
    maxIdle: 10,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
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
    realPool = mysql.createPool(dbConfigFromEnv());
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
 * The default export behaves like a mysql2 promise Pool (`pool.execute`,
 * `pool.query`, `pool.getConnection`, ...). It creates the real pool on the
 * first property access, so existing `import pool from '@/lib/db'` code keeps
 * working unchanged.
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
