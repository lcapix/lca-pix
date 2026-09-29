import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createPool = vi.fn();

vi.mock('mysql2/promise', () => ({
  default: { createPool: (...args: unknown[]) => createPool(...args) },
  createPool: (...args: unknown[]) => createPool(...args),
}));

const DB_VARS = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'DATABASE_SSL',
  'DATABASE_SSL_CA',
] as const;

const saved: Record<string, string | undefined> = {};

function fakePool() {
  return {
    execute: vi.fn(async () => [[{ ok: 1 }], []]),
    getConnection: vi.fn(async () => ({ release: vi.fn() })),
    end: vi.fn(async () => undefined),
  };
}

function setLocalEnv() {
  process.env.DATABASE_HOST = '127.0.0.1';
  process.env.DATABASE_PORT = '3306';
  process.env.DATABASE_USER = 'app_user';
  process.env.DATABASE_PASSWORD = 'not-a-real-password';
  process.env.DATABASE_NAME = 'lcapix_test';
}

describe('lib/db', () => {
  beforeEach(() => {
    for (const k of DB_VARS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    createPool.mockReset();
    createPool.mockImplementation(() => fakePool());
    vi.resetModules();
  });

  afterEach(() => {
    for (const k of DB_VARS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('imports without env vars and without creating a pool or connecting', async () => {
    const mod = await import('@/lib/db');
    expect(mod.default).toBeDefined();
    expect(createPool).not.toHaveBeenCalled();
  });

  it('awaiting or inspecting the pool does not create it', async () => {
    const { default: pool } = await import('@/lib/db');
    // `await` looks up `then`; that must not trigger a connection attempt.
    const awaited = await Promise.resolve(pool);
    expect(awaited).toBe(pool);
    expect(createPool).not.toHaveBeenCalled();
  });

  it('throws a clear error naming every missing variable on the first query', async () => {
    const { default: pool } = await import('@/lib/db');
    await expect(async () => pool.execute('SELECT 1')).rejects.toThrow(
      /missing DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME/,
    );
    expect(createPool).not.toHaveBeenCalled();
  });

  it('names only the variables that are actually missing', async () => {
    process.env.DATABASE_HOST = '127.0.0.1';
    process.env.DATABASE_PASSWORD = '';
    const { default: pool } = await import('@/lib/db');
    await expect(async () => pool.getConnection()).rejects.toThrow(
      /missing DATABASE_USER, DATABASE_NAME\./,
    );
  });

  it('has no host, user or database fallbacks baked in', async () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../lib/db.ts'), 'utf8');
    expect(src).not.toMatch(/rds\.amazonaws\.com/);
    expect(src).not.toMatch(/process\.env\.DATABASE_(HOST|USER|PASSWORD|NAME)\s*\|\|/);
  });

  it('creates the pool once, lazily, from env only', async () => {
    setLocalEnv();
    const { default: pool } = await import('@/lib/db');
    expect(createPool).not.toHaveBeenCalled();

    await pool.execute('SELECT 1');
    await pool.getConnection();

    expect(createPool).toHaveBeenCalledTimes(1);
    const opts = createPool.mock.calls[0][0];
    expect(opts).toMatchObject({
      host: '127.0.0.1',
      port: 3306,
      user: 'app_user',
      password: 'not-a-real-password',
      database: 'lcapix_test',
    });
    expect(opts.ssl).toBeUndefined();
  });

  it('turns on verified TLS with DATABASE_SSL=true and reads the CA from a file', async () => {
    setLocalEnv();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcapix-db-test-'));
    const caPath = path.join(dir, 'ca.pem');
    fs.writeFileSync(caPath, '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n');
    process.env.DATABASE_SSL = 'true';
    process.env.DATABASE_SSL_CA = caPath;

    const { getPool } = await import('@/lib/db');
    getPool();
    const opts = createPool.mock.calls[0][0];
    expect(opts.ssl).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n',
    });
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('accepts inline PEM in DATABASE_SSL_CA and verifies certs without one', async () => {
    setLocalEnv();
    process.env.DATABASE_SSL = 'true';
    const { dbConfigFromEnv } = await import('@/lib/db');
    expect(dbConfigFromEnv().ssl).toEqual({ rejectUnauthorized: true });

    process.env.DATABASE_SSL_CA = '-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----';
    expect(dbConfigFromEnv().ssl).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----',
    });
  });

  it('reports an unreadable CA path clearly', async () => {
    setLocalEnv();
    process.env.DATABASE_SSL = 'true';
    process.env.DATABASE_SSL_CA = '/nonexistent/lcapix/ca.pem';
    const { dbConfigFromEnv } = await import('@/lib/db');
    expect(() => dbConfigFromEnv()).toThrow(/DATABASE_SSL_CA points to a file that cannot be read/);
  });
});
