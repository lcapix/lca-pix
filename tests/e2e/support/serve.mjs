#!/usr/bin/env node
/**
 * Playwright's webServer for the browser suite.
 *
 *   1. Builds a throwaway database lcapix_t_e2e_<time>_<hex> from nothing with
 *      scripts/db/fresh.mjs (baseline schema + reference seed + every
 *      migration) on the local MySQL named by DATABASE_HOST/PORT/USER/PASSWORD.
 *      Only 127.0.0.1 / localhost / ::1 are accepted (fresh.mjs refuses others).
 *   2. Runs `next dev -p 3120` against it, with outbound network blocked
 *      (block-outbound.cjs) and every third-party key blanked.
 *   3. On SIGTERM / SIGINT (Playwright's gracefulShutdown) or when Next exits,
 *      drops the database. globalTeardown drops it too, so a hard kill of this
 *      process still leaves nothing behind. E2E_KEEP_DB=1 keeps it.
 *
 * Also drops lcapix_t_e2e_* databases left by runs that were killed more than
 * three hours ago (never a younger one: that may be a run in progress).
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFreshDatabase, dropDatabase, listThrowaway, serverFromEnv } from '../../../scripts/db/fresh.mjs';

// Keep in step with support/paths.ts.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const PORT = Number(process.env.E2E_PORT || 3120);
const ARTIFACTS_DIR = process.env.E2E_ARTIFACTS_DIR || path.join(os.tmpdir(), `lcapix-e2e-${PORT}`);
const STATE_DIR = path.join(ARTIFACTS_DIR, 'state');
const SERVER_STATE = path.join(STATE_DIR, 'server.json');
const DB_PREFIX = 'lcapix_t_e2e_';

const envFile = path.join(REPO_ROOT, '.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile); // never overrides variables already set

const log = (s) => process.stderr.write(`[e2e serve] ${s}\n`);
const server = serverFromEnv();

// 1. Leftovers from killed runs.
const STALE_MS = 3 * 60 * 60 * 1000;
for (const name of listThrowaway(server)) {
  const m = new RegExp(`^${DB_PREFIX}([0-9a-z]+)_[0-9a-f]{6}$`).exec(name);
  if (!m) continue;
  const t = parseInt(m[1], 36);
  if (Number.isFinite(t) && Date.now() - t > STALE_MS) {
    dropDatabase(name, server);
    log(`dropped stale ${name}`);
  }
}

// 2. A fresh database.
const database = `${DB_PREFIX}${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
createFreshDatabase({ name: database, server, log });
mkdirSync(STATE_DIR, { recursive: true });
writeFileSync(SERVER_STATE, JSON.stringify({ database, port: PORT, pid: process.pid, startedAt: new Date().toISOString() }, null, 2));

let dropped = false;
function dropOnce() {
  if (dropped) return;
  dropped = true;
  if (process.env.E2E_KEEP_DB === '1') {
    log(`E2E_KEEP_DB=1: kept ${database} (drop it with: node scripts/db/fresh.mjs --drop ${database})`);
    return;
  }
  try {
    dropDatabase(database, server);
    log(`dropped ${database}`);
  } catch (e) {
    log(`could not drop ${database}: ${e?.message ?? e}`);
  }
}

// 3. The dev server. Blank every key that would let the server call out, even
//    if .env.local sets it (Next never overrides a variable that is already set,
//    empty or not).
const blanked = [
  'HF_TOKEN', 'HUGGINGFACE_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'GOOGLE_CLIENT_SECRET', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID',
  'BLS_API_KEY', 'EIA_API_KEY', 'METALS_API_KEY', 'METALPRICE_API_KEY', 'ELECTRICITY_MAPS_API_KEY',
  'EMBER_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN',
];
const env = { ...process.env };
for (const k of blanked) env[k] = '';
Object.assign(env, {
  DATABASE_HOST: server.host,
  DATABASE_PORT: server.port,
  DATABASE_USER: server.user,
  DATABASE_PASSWORD: server.password,
  DATABASE_NAME: database,
  JWT_SECRET: process.env.JWT_SECRET || `e2e-only-${randomBytes(16).toString('hex')}`,
  NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
  NEXT_TELEMETRY_DISABLED: '1',
  RATE_LIMIT_STORE: 'memory',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${path.join(REPO_ROOT, 'tests/e2e/support/block-outbound.cjs')}`.trim(),
});

const nextBin = path.join(REPO_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
log(`next dev -p ${PORT} → ${database}`);
const child = spawn(process.execPath, [nextBin, 'dev', '-p', String(PORT)], {
  cwd: REPO_ROOT,
  env,
  stdio: ['ignore', 'inherit', 'inherit'],
});

let stopping = false;
function stop(signal) {
  if (stopping) return;
  stopping = true;
  log(`${signal}: stopping next dev`);
  if (child.exitCode === null) child.kill('SIGTERM');
  const force = setTimeout(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  }, 5000);
  force.unref();
}
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => stop(sig));

child.on('exit', (code, signal) => {
  dropOnce();
  process.exit(stopping ? 0 : code ?? (signal ? 1 : 0));
});
