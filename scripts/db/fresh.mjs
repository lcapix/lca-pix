#!/usr/bin/env node
/**
 * A throwaway Postgres database built from nothing: db/pg/000-schema.sql, the
 * library in db/pg/001-reference.sql (both recorded in schema_migrations),
 * then every numbered migration in db/pg/migrations through migrate.mjs.
 *
 *   node --env-file=.env.local scripts/db/fresh.mjs               create one, print its name
 *   node --env-file=.env.local scripts/db/fresh.mjs --no-migrate  baseline only (for runner tests)
 *   node --env-file=.env.local scripts/db/fresh.mjs --name=lcapix_t_mine
 *   node --env-file=.env.local scripts/db/fresh.mjs --from=lcapix_prodcopy   a copy of another local database
 *   node --env-file=.env.local scripts/db/fresh.mjs --drop lcapix_t_xxx
 *   node --env-file=.env.local scripts/db/fresh.mjs --list        list lcapix_t_* databases
 *   node --env-file=.env.local scripts/db/fresh.mjs --drop-stale  drop lcapix_t_* databases made over 60 min ago
 *   node --env-file=.env.local scripts/db/fresh.mjs --drop-stale=10   ... over 10 min ago
 *   node --env-file=.env.local scripts/db/fresh.mjs --drop-all    drop every lcapix_t_* database, including
 *                                                                 one a test run in another worktree is using
 *
 * - Only ever creates or drops databases named lcapix_t_<something>, and only
 *   on 127.0.0.1 / localhost / ::1. There is no override: a remote host is
 *   refused outright.
 * - Uses DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD for
 *   the connection. DATABASE_NAME is ignored (the new name is generated), so
 *   the database .env.local points at is never touched.
 * - Progress goes to stderr; stdout carries only the new database name, so a
 *   caller can do NAME=$(node scripts/db/fresh.mjs).
 * - If any step fails the half-built database is dropped (unless
 *   --keep-on-error) and the exit code is 1.
 * - --from copies an existing local database (Postgres's CREATE DATABASE ...
 *   TEMPLATE): the release journey on a copy of production, without touching it.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { BASELINE_FILES, baselineEntries, isLocalHost } from './migrate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export { BASELINE_FILES };
export const NAME_PREFIX = 'lcapix_t_';
const NAME_RE = /^lcapix_t_[a-z0-9_]{1,55}$/;

/** @param {string} name */
export function isThrowawayName(name) {
  return NAME_RE.test(String(name ?? ''));
}

export function newName(now = Date.now()) {
  return `${NAME_PREFIX}${now.toString(36)}_${randomBytes(3).toString('hex')}`;
}

/** When a generated name was made (ms since epoch), or null for a hand-picked name. */
export function createdAt(name) {
  const m = /^lcapix_t_([0-9a-z]{6,10})_[0-9a-f]{6}$/.exec(String(name ?? ''));
  if (!m) return null;
  const t = parseInt(m[1], 36);
  return Number.isFinite(t) && t > Date.UTC(2020, 0, 1) && t < Date.now() + 86_400_000 ? t : null;
}

/** Connection settings from the environment (DATABASE_NAME deliberately ignored). */
export function serverFromEnv(env = process.env) {
  return {
    host: (env.DATABASE_HOST || '127.0.0.1').trim(),
    port: (env.DATABASE_PORT || '5432').trim(),
    user: (env.DATABASE_USER || 'postgres').trim(),
    password: env.DATABASE_PASSWORD || '',
  };
}

function assertLocal(server) {
  if (!isLocalHost(server.host)) {
    throw new Error(
      `Refusing: DATABASE_HOST is ${server.host}. fresh.mjs only creates and drops databases on 127.0.0.1, localhost or ::1.`,
    );
  }
}

/** A client on `database` (the server's maintenance database by default). */
async function client(server, database = 'postgres') {
  const c = new pg.Client({
    host: server.host,
    port: Number(server.port),
    user: server.user,
    password: server.password || undefined,
    database,
  });
  await c.connect();
  return c;
}

/** Runs fn with a client on the maintenance database, then closes it. */
async function onServer(server, fn) {
  const c = await client(server);
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export async function listThrowaway(server = serverFromEnv()) {
  assertLocal(server);
  return onServer(server, async (c) =>
    (await c.query(`SELECT datname FROM pg_database WHERE datname LIKE 'lcapix\\_t\\_%' ORDER BY datname`)).rows
      .map((r) => r.datname)
      .filter(isThrowawayName),
  );
}

/** @param {string} name */
export async function dropDatabase(name, server = serverFromEnv()) {
  assertLocal(server);
  if (!isThrowawayName(name)) {
    throw new Error(`Refusing to drop "${name}": only databases named ${NAME_PREFIX}<letters, digits, _> are dropped.`);
  }
  await onServer(server, (c) => c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`));
}

/**
 * Create and populate a throwaway database. Resolves to its name.
 * @param {{ name?: string, migrate?: boolean, keepOnError?: boolean, log?: (s: string) => void, server?: ReturnType<typeof serverFromEnv>, fromTemplate?: string }} [opts]
 */
export async function createFreshDatabase(opts = {}) {
  const server = opts.server ?? serverFromEnv();
  const log = opts.log ?? ((s) => process.stderr.write(`${s}\n`));
  assertLocal(server);
  const name = opts.name ?? newName();
  if (!isThrowawayName(name)) throw new Error(`Bad name "${name}": must match ${NAME_RE}`);
  if (opts.fromTemplate && !/^[a-z0-9_]{1,63}$/.test(opts.fromTemplate)) throw new Error(`Bad source database "${opts.fromTemplate}"`);
  for (const f of opts.fromTemplate ? [] : BASELINE_FILES) {
    if (!existsSync(f)) throw new Error(`Missing ${path.relative(REPO_ROOT, f)}`);
  }

  const started = Date.now();
  // Fails if the name is taken: never reuse or overwrite an existing database.
  await onServer(server, (c) => c.query(`CREATE DATABASE "${name}"${opts.fromTemplate ? ` TEMPLATE "${opts.fromTemplate}"` : ''}`));
  log(`fresh: created ${name} on ${server.host}:${server.port}${opts.fromTemplate ? ` as a copy of ${opts.fromTemplate}` : ''}`);
  try {
    if (!opts.fromTemplate) {
      const c = await client(server, name);
      try {
        const files = baselineEntries();
        for (const f of files) {
          await c.query(readFileSync(f.path, 'utf8'));
          log(`fresh: applied ${path.relative(REPO_ROOT, f.path)}`);
        }
        for (const f of files) {
          await c.query('INSERT INTO schema_migrations (filename, checksum, baseline) VALUES ($1, $2, 1)', [f.filename, f.checksum]);
        }
      } finally {
        await c.end();
      }
    }
    if (opts.migrate !== false) {
      const r = spawnSync(process.execPath, [path.join(HERE, 'migrate.mjs')], {
        env: {
          ...process.env,
          DATABASE_URL: '',
          DATABASE_HOST: server.host,
          DATABASE_PORT: server.port,
          DATABASE_USER: server.user,
          DATABASE_PASSWORD: server.password,
          DATABASE_NAME: name,
        },
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      });
      const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
      if (r.status !== 0) throw new Error(`migrate.mjs failed on ${name} (exit ${r.status}):\n${out.trim()}`);
      log(`fresh: migrate.mjs applied ${out.split('\n').filter((l) => l.startsWith('applying')).length} migration(s)`);
    }
  } catch (e) {
    if (opts.keepOnError) {
      log(`fresh: FAILED; kept ${name} for inspection (drop it with --drop ${name})`);
    } else {
      try {
        await dropDatabase(name, server);
        log(`fresh: FAILED; dropped ${name}`);
      } catch (dropErr) {
        log(`fresh: FAILED and could not drop ${name}: ${String(dropErr)}`);
      }
    }
    throw e;
  }
  log(`fresh: ${name} ready in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  return name;
}

async function main(argv) {
  const has = (flag) => argv.includes(flag);
  const valueOf = (flag) => {
    const eq = argv.find((a) => a.startsWith(`${flag}=`));
    if (eq) return eq.slice(flag.length + 1);
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const known = new Set(['--drop', '--drop-all', '--drop-stale', '--list', '--no-migrate', '--keep-on-error', '--name', '--from']);
  for (const a of argv) {
    const flag = a.split('=')[0];
    if (a.startsWith('--') && !known.has(flag)) {
      console.error(`Unknown argument: ${a}`);
      return 2;
    }
  }

  if (has('--list')) {
    for (const n of await listThrowaway()) console.log(n);
    return 0;
  }
  const staleArg = argv.find((a) => a === '--drop-stale' || a.startsWith('--drop-stale='));
  if (staleArg) {
    const minutes = staleArg.includes('=') ? Number(staleArg.split('=')[1]) : 60;
    if (!Number.isFinite(minutes) || minutes < 0) {
      console.error(`Bad value: ${staleArg}`);
      return 2;
    }
    const cutoff = Date.now() - minutes * 60_000;
    let n = 0;
    for (const name of await listThrowaway()) {
      const t = createdAt(name);
      if (t === null || t > cutoff) continue;
      await dropDatabase(name);
      console.error(`fresh: dropped ${name}`);
      n++;
    }
    console.error(`fresh: dropped ${n} database(s) made more than ${minutes} min ago`);
    return 0;
  }
  if (has('--drop-all')) {
    const names = await listThrowaway();
    for (const n of names) {
      await dropDatabase(n);
      console.error(`fresh: dropped ${n}`);
    }
    console.error(`fresh: dropped ${names.length} database(s)`);
    return 0;
  }
  if (has('--drop')) {
    const name = valueOf('--drop');
    if (!name) {
      console.error('Usage: fresh.mjs --drop lcapix_t_<name>');
      return 2;
    }
    await dropDatabase(name);
    console.error(`fresh: dropped ${name}`);
    return 0;
  }
  const name = await createFreshDatabase({
    name: valueOf('--name'),
    migrate: !has('--no-migrate'),
    keepOnError: has('--keep-on-error'),
    fromTemplate: valueOf('--from'),
  });
  console.log(name);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      console.error(String(/** @type {Error} */ (e)?.message ?? e));
      process.exit(1);
    },
  );
}
