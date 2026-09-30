#!/usr/bin/env node
/**
 * A throwaway database built from nothing: baseline schema, reference seed,
 * then every numbered migration through scripts/db/migrate.mjs.
 *
 *   node --env-file=.env.local scripts/db/fresh.mjs               create one, print its name
 *   node --env-file=.env.local scripts/db/fresh.mjs --no-migrate  baseline + seed only (for runner tests)
 *   node --env-file=.env.local scripts/db/fresh.mjs --name=lcapix_t_mine
 *   node --env-file=.env.local scripts/db/fresh.mjs --drop lcapix_t_xxx
 *   node --env-file=.env.local scripts/db/fresh.mjs --list        list lcapix_t_* databases
 *   node --env-file=.env.local scripts/db/fresh.mjs --drop-all    drop every lcapix_t_* database
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
 * - New migrate-NNN-*.sql files are picked up automatically: this script
 *   hands the whole chain to migrate.mjs, which lists the directory.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isLocalHost } from './migrate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const BASELINE_FILES = [
  path.join(REPO_ROOT, 'db', 'baseline', '000-schema.sql'),
  path.join(REPO_ROOT, 'db', 'baseline', '001-reference.sql'),
];
export const NAME_PREFIX = 'lcapix_t_';
const NAME_RE = /^lcapix_t_[a-z0-9_]{1,55}$/;

/** @param {string} name */
export function isThrowawayName(name) {
  return NAME_RE.test(String(name ?? ''));
}

export function newName() {
  return `${NAME_PREFIX}${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
}

/** Connection settings from the environment (DATABASE_NAME deliberately ignored). */
export function serverFromEnv(env = process.env) {
  return {
    host: (env.DATABASE_HOST || '127.0.0.1').trim(),
    port: (env.DATABASE_PORT || '3306').trim(),
    user: (env.DATABASE_USER || 'root').trim(),
    password: env.DATABASE_PASSWORD || '',
  };
}

/**
 * @param {{ host: string, port: string, user: string, password: string }} server
 * @param {string | null} database
 * @param {string[]} extra
 * @param {string | undefined} input
 */
function mysql(server, database, extra, input) {
  const args = [
    `--host=${server.host}`,
    `--port=${server.port}`,
    `--user=${server.user}`,
    '--default-character-set=utf8mb4',
    ...extra,
  ];
  if (database) args.push(database);
  const env = { ...process.env };
  if (server.password) env.MYSQL_PWD = server.password;
  else delete env.MYSQL_PWD;
  const r = spawnSync('mysql', args, { input, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) {
    if (/** @type {NodeJS.ErrnoException} */ (r.error).code === 'ENOENT') {
      throw new Error('The mysql command-line client is not on PATH. Install it (brew install mysql-client, apt-get install mysql-client).');
    }
    throw r.error;
  }
  return r;
}

function sql(server, statement) {
  const r = mysql(server, null, ['--batch', '--skip-column-names', '-e', statement], undefined);
  if (r.status !== 0) throw new Error(`mysql failed: ${r.stderr.trim()}`);
  return r.stdout;
}

function assertLocal(server) {
  if (!isLocalHost(server.host)) {
    throw new Error(
      `Refusing: DATABASE_HOST is ${server.host}. fresh.mjs only creates and drops databases on 127.0.0.1, localhost or ::1.`,
    );
  }
}

export function listThrowaway(server = serverFromEnv()) {
  assertLocal(server);
  return sql(server, `SHOW DATABASES LIKE 'lcapix\\_t\\_%'`)
    .split('\n')
    .map((s) => s.trim())
    .filter(isThrowawayName);
}

/** @param {string} name */
export function dropDatabase(name, server = serverFromEnv()) {
  assertLocal(server);
  if (!isThrowawayName(name)) {
    throw new Error(`Refusing to drop "${name}": only databases named ${NAME_PREFIX}<letters, digits, _> are dropped.`);
  }
  sql(server, `DROP DATABASE IF EXISTS \`${name}\``);
}

/**
 * Create and populate a throwaway database. Returns its name.
 * @param {{ name?: string, migrate?: boolean, keepOnError?: boolean, log?: (s: string) => void, server?: ReturnType<typeof serverFromEnv> }} [opts]
 */
export function createFreshDatabase(opts = {}) {
  const server = opts.server ?? serverFromEnv();
  const log = opts.log ?? ((s) => process.stderr.write(`${s}\n`));
  assertLocal(server);
  const name = opts.name ?? newName();
  if (!isThrowawayName(name)) throw new Error(`Bad name "${name}": must match ${NAME_RE}`);
  for (const f of BASELINE_FILES) {
    if (!existsSync(f)) throw new Error(`Missing ${path.relative(REPO_ROOT, f)}`);
  }

  const started = Date.now();
  // Fails if the name is taken: never reuse or overwrite an existing database.
  sql(server, `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  log(`fresh: created ${name} on ${server.host}:${server.port}`);
  try {
    for (const f of BASELINE_FILES) {
      const r = mysql(server, name, [], readFileSync(f, 'utf8'));
      if (r.status !== 0) throw new Error(`${path.relative(REPO_ROOT, f)} failed:\n${r.stderr.trim()}`);
      log(`fresh: applied ${path.relative(REPO_ROOT, f)}`);
    }
    if (opts.migrate !== false) {
      const r = spawnSync(process.execPath, [path.join(HERE, 'migrate.mjs')], {
        env: {
          ...process.env,
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
      const applied = out.split('\n').filter((l) => l.startsWith('applying')).length;
      if (r.status !== 0) {
        throw new Error(`migrate.mjs failed on ${name} (exit ${r.status}):\n${out.trim()}`);
      }
      log(`fresh: migrate.mjs applied ${applied} migration(s)`);
    }
  } catch (e) {
    if (opts.keepOnError) {
      log(`fresh: FAILED; kept ${name} for inspection (drop it with --drop ${name})`);
    } else {
      try {
        dropDatabase(name, server);
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

function main(argv) {
  const has = (flag) => argv.includes(flag);
  const valueOf = (flag) => {
    const eq = argv.find((a) => a.startsWith(`${flag}=`));
    if (eq) return eq.slice(flag.length + 1);
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const known = new Set(['--drop', '--drop-all', '--list', '--no-migrate', '--keep-on-error', '--name']);
  for (const a of argv) {
    const flag = a.split('=')[0];
    if (a.startsWith('--') && !known.has(flag)) {
      console.error(`Unknown argument: ${a}`);
      return 2;
    }
  }

  if (has('--list')) {
    for (const n of listThrowaway()) console.log(n);
    return 0;
  }
  if (has('--drop-all')) {
    const names = listThrowaway();
    for (const n of names) {
      dropDatabase(n);
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
    dropDatabase(name);
    console.error(`fresh: dropped ${name}`);
    return 0;
  }
  const name = createFreshDatabase({
    name: valueOf('--name'),
    migrate: !has('--no-migrate'),
    keepOnError: has('--keep-on-error'),
  });
  console.log(name);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(String(/** @type {Error} */ (e)?.message ?? e));
    process.exit(1);
  }
}
