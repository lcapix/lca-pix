/**
 * Global setup for the database suite (vitest.db.config.ts).
 *
 * 1. Reads the connection from the environment, then .env.local for anything
 *    not already set. DATABASE_NAME is NOT used: the suite never touches the
 *    database .env.local points at.
 * 2. Refuses any host but 127.0.0.1 / localhost / ::1.
 * 3. Builds a throwaway lcapix_t_* database with scripts/db/fresh.mjs
 *    (baseline schema + reference seed + every migration) and hands its name
 *    to the workers.
 * 4. Teardown drops it, pass or fail. DB_TESTS_KEEP=1 keeps it for
 *    inspection (drop it later with fresh.mjs --drop NAME or --drop-all).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import type { TestDbConfig } from './context';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const FRESH = path.join(ROOT, 'scripts', 'db', 'fresh.mjs');
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

function fresh(args: string[], env: NodeJS.ProcessEnv) {
  const r = spawnSync(process.execPath, [FRESH, ...args], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return r;
}

export default function setup(project: TestProject) {
  const envFile = path.join(ROOT, '.env.local');
  if (existsSync(envFile)) process.loadEnvFile(envFile); // never overrides variables already set

  const server = {
    host: (process.env.DATABASE_HOST || '127.0.0.1').trim(),
    port: (process.env.DATABASE_PORT || '3306').trim(),
    user: (process.env.DATABASE_USER || 'root').trim(),
    password: process.env.DATABASE_PASSWORD ?? '',
  };
  if (!LOCAL_HOSTS.includes(server.host.toLowerCase())) {
    throw new Error(`Database tests run only against a local MySQL; DATABASE_HOST is ${server.host}.`);
  }

  const env = {
    ...process.env,
    DATABASE_HOST: server.host,
    DATABASE_PORT: server.port,
    DATABASE_USER: server.user,
    DATABASE_PASSWORD: server.password,
  };
  const built = fresh([], env);
  if (built.status !== 0) {
    throw new Error(`scripts/db/fresh.mjs could not build the test database:\n${built.stderr.trim()}`);
  }
  const database = built.stdout.trim().split('\n').pop()!.trim();
  process.stderr.write(built.stderr);

  const e2eLocal = process.env.DB_TESTS_E2E_LOCAL === '1';
  if (e2eLocal) {
    // tests/e2e-local signs in as "the first active account". A fresh
    // database has none, so add one throwaway account (no usable password).
    const r = spawnSync(
      'mysql',
      [`--host=${server.host}`, `--port=${server.port}`, `--user=${server.user}`, database, '-e',
        "INSERT INTO account (username, email, password_hash, account_type, is_active) VALUES ('e2e-local-fixture', 'e2e-local-fixture@example.test', '!', 'user', 1)"],
      { env: { ...env, MYSQL_PWD: server.password || undefined }, encoding: 'utf8' },
    );
    if (r.status !== 0) throw new Error(`Could not add the e2e-local fixture account: ${r.stderr}`);
  }

  const config: TestDbConfig = { ...server, database };
  process.env.DATABASE_NAME = database;
  project.provide('testDb', config);
  project.provide('e2eLocal', e2eLocal);

  return () => {
    if (process.env.DB_TESTS_KEEP === '1') {
      process.stderr.write(`DB_TESTS_KEEP=1: kept ${database}. Drop it with: node scripts/db/fresh.mjs --drop ${database}\n`);
      return;
    }
    const dropped = fresh(['--drop', database], env);
    if (dropped.status !== 0) {
      throw new Error(`Could not drop ${database}: ${dropped.stderr.trim()}`);
    }
  };
}
