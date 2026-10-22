#!/usr/bin/env node
/**
 * Migration runner for the Postgres schema (db/pg).
 *
 *   node --env-file=.env.local scripts/db/migrate.mjs             apply pending
 *   node --env-file=.env.local scripts/db/migrate.mjs --dry-run   list, change nothing
 *
 * - The baseline is db/pg/000-schema.sql (the schema at MySQL migration 042)
 *   and db/pg/001-reference.sql (the library data). fresh.mjs and the one-time
 *   load (scripts/db/pg/copy-from-mysql.mjs) apply them and record both in
 *   schema_migrations. This runner applies what came after: the numbered
 *   files in db/pg/migrations (migrate-NNN-*.sql; the numbers carry on from
 *   the MySQL series, so the first is 043).
 * - Each file runs in one transaction together with its ledger row: a file
 *   that fails changes nothing and is not recorded, and the run stops there.
 * - Records each applied file (filename, sha256 checksum, applied_at) and never
 *   runs a recorded file again. A recorded file whose checksum has changed is
 *   reported, not re-run: a data change needs a new number.
 * - Refuses any host other than 127.0.0.1 / localhost / ::1 unless
 *   --allow-remote is given AND the database name is typed back at an
 *   interactive prompt. With no terminal, a remote run is refused.
 *
 * Connection: DATABASE_URL, or DATABASE_HOST, DATABASE_PORT, DATABASE_USER,
 * DATABASE_PASSWORD, DATABASE_NAME.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
export const MIGRATIONS_DIR = path.join(REPO_ROOT, 'db', 'pg', 'migrations');
/** The baseline files, in the order they are applied; each is recorded by its name. */
export const BASELINE_FILES = [path.join(REPO_ROOT, 'db', 'pg', '000-schema.sql'), path.join(REPO_ROOT, 'db', 'pg', '001-reference.sql')];
const FILE_RE = /^migrate-(\d{3})-[A-Za-z0-9._-]+\.sql$/;

/** @param {string} text */
export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Numbered migrations in a directory, in numeric order.
 * @param {string} dir
 * @returns {{ number: number, filename: string, path: string, checksum: string }[]}
 */
export function listMigrations(dir) {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .map((filename) => ({ filename, m: FILE_RE.exec(filename) }))
    .filter((x) => x.m)
    .map(({ filename, m }) => {
      const full = path.join(dir, filename);
      return {
        number: Number(/** @type {RegExpExecArray} */ (m)[1]),
        filename,
        path: full,
        checksum: sha256(readFileSync(full, 'utf8')),
      };
    })
    .sort((a, b) => a.number - b.number || a.filename.localeCompare(b.filename));
  for (let i = 1; i < files.length; i++) {
    if (files[i].number === files[i - 1].number) {
      const n = String(files[i].number).padStart(3, '0');
      throw new Error(
        `Two migrations share number ${n}: ${files[i - 1].filename} and ${files[i].filename}. Renumber one.`,
      );
    }
  }
  return files;
}

/** The baseline files as ledger entries. */
export function baselineEntries() {
  return BASELINE_FILES.map((full) => ({ filename: path.basename(full), path: full, checksum: sha256(readFileSync(full, 'utf8')) }));
}

/** @param {string | undefined | null} host */
export function isLocalHost(host) {
  const h = String(host ?? '').trim().toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]';
}

/**
 * @param {{ filename: string, checksum: string }[]} files
 * @param {Map<string, string>} ledger filename → checksum
 */
export function planMigrations(files, ledger) {
  const applied = files.filter((f) => ledger.has(f.filename));
  return {
    applied,
    pending: files.filter((f) => !ledger.has(f.filename)),
    changed: applied.filter((f) => ledger.get(f.filename) !== f.checksum),
  };
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const opts = { dryRun: false, allowRemote: false, dir: MIGRATIONS_DIR };
  for (const a of argv) {
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--allow-remote') opts.allowRemote = true;
    else if (a.startsWith('--dir=')) opts.dir = path.resolve(a.slice('--dir='.length));
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

/**
 * pg settings for a connection string. A database that is not on this machine
 * gets TLS with certificate checks unless the string sets sslmode itself:
 * Neon refuses a plain connection, and a string copied without its query
 * part (?sslmode=require) must not quietly fall back to one.
 * @param {string} url
 */
export function pgConfigFromUrl(url) {
  const u = new URL(url);
  const needsTls = !isLocalHost(u.hostname) && !u.searchParams.has('sslmode') && !u.searchParams.has('ssl');
  return needsTls ? { connectionString: url, ssl: { rejectUnauthorized: true } } : { connectionString: url };
}

/**
 * Connection settings from the environment: DATABASE_URL, else the parts.
 * Returns null when no database is named.
 * @param {NodeJS.ProcessEnv} env
 */
export function connectionFromEnv(env = process.env) {
  if (env.DATABASE_URL) {
    const u = new URL(env.DATABASE_URL);
    const database = decodeURIComponent(u.pathname.replace(/^\//, ''));
    return database ? { config: pgConfigFromUrl(env.DATABASE_URL), host: u.hostname, database } : null;
  }
  const database = (env.DATABASE_NAME || '').trim();
  if (!database) return null;
  const host = (env.DATABASE_HOST || '127.0.0.1').trim();
  return {
    config: {
      host,
      port: Number((env.DATABASE_PORT || '5432').trim()),
      user: (env.DATABASE_USER || 'postgres').trim(),
      password: env.DATABASE_PASSWORD || undefined,
      database,
      ...((env.DATABASE_SSL ?? '').toLowerCase() === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
    },
    host,
    database,
  };
}

/** @param {pg.Client} client */
export async function readLedger(client) {
  const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations ORDER BY filename');
  return new Map(rows.map((r) => [r.filename, r.checksum]));
}

/**
 * Runs one file and its ledger row in a single transaction.
 * @param {pg.Client} client
 * @param {{ filename: string, checksum: string }} file
 * @param {string} text
 * @param {boolean} baseline
 */
export async function applyRecorded(client, file, text, baseline) {
  await client.query('BEGIN');
  try {
    await client.query(text);
    await client.query('INSERT INTO schema_migrations (filename, checksum, baseline) VALUES ($1, $2, $3)', [
      file.filename,
      file.checksum,
      baseline ? 1 : 0,
    ]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(String(/** @type {Error} */ (e).message));
    return 2;
  }
  const conn = connectionFromEnv();
  if (!conn) {
    console.error('DATABASE_NAME (or DATABASE_URL) is not set. Run with: node --env-file=.env.local scripts/db/migrate.mjs');
    return 2;
  }

  if (!isLocalHost(conn.host)) {
    if (!opts.allowRemote) {
      console.error(
        `Refusing to migrate ${conn.database} on non-local host ${conn.host}. This runner only touches 127.0.0.1/localhost unless --allow-remote is passed and confirmed interactively.`,
      );
      return 2;
    }
    if (!process.stdin.isTTY) {
      console.error(`Refusing --allow-remote for ${conn.host}: the confirmation must be typed at an interactive terminal.`);
      return 2;
    }
    const answer = await ask(
      `About to run migrations against REMOTE host ${conn.host}, database ${conn.database}.\nType the database name to continue: `,
    );
    if (String(answer).trim() !== conn.database) {
      console.error('Confirmation did not match. Nothing was run.');
      return 2;
    }
  }

  let files;
  try {
    files = listMigrations(opts.dir);
  } catch (e) {
    console.error(String(/** @type {Error} */ (e).message));
    return 2;
  }
  const client = new pg.Client(conn.config);
  await client.connect();
  const where = `${conn.database}@${conn.host}`;
  try {
    let ledger;
    try {
      ledger = await readLedger(client);
    } catch (e) {
      if (e?.code === '42P01') {
        console.error(`${where} has no schema_migrations ledger: build it from the baseline first (scripts/db/fresh.mjs, or the load).`);
        return 2;
      }
      throw e;
    }
    for (const b of baselineEntries()) {
      if (!ledger.has(b.filename)) {
        console.error(`${where} does not record ${b.filename}: it was not built from this baseline. Nothing was run.`);
        return 2;
      }
    }
    const plan = planMigrations(files, ledger);
    for (const f of plan.changed) {
      console.warn(
        `WARNING: ${f.filename} changed since it was recorded on ${where} (checksum differs). It is NOT re-run; write a new numbered migration for any data change.`,
      );
    }
    if (plan.pending.length === 0) {
      console.log(`Nothing to apply on ${where}: all ${files.length} migration(s) recorded.`);
      return 0;
    }
    for (const f of plan.pending) {
      if (opts.dryRun) {
        console.log(`pending   ${f.filename}`);
        continue;
      }
      console.log(`applying  ${f.filename}`);
      try {
        await applyRecorded(client, f, readFileSync(f.path, 'utf8'), false);
      } catch (e) {
        console.error(`FAILED    ${f.filename}\n${e?.message ?? e}\nStopped. ${f.filename} changed nothing and was not recorded; later files were not run.`);
        return 1;
      }
    }
    console.log(`${opts.dryRun ? 'Would apply' : 'Applied'} ${plan.pending.length} migration(s) on ${where}.`);
    return 0;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err?.stack || String(err));
      process.exit(1);
    },
  );
}
