#!/usr/bin/env node
/**
 * Migration runner for the numbered root migrations (migrate-0NN-*.sql).
 *
 *   node --env-file=.env.local scripts/db/migrate.mjs             apply pending
 *   node --env-file=.env.local scripts/db/migrate.mjs --dry-run   list, change nothing
 *   node --env-file=.env.local scripts/db/migrate.mjs --baseline  mark 009-025 applied
 *
 * - Applies files in numeric order through the `mysql` CLI, so files that use
 *   DELIMITER (014, 018, 020, 021, 022) work. A file that fails stops the run
 *   and is not recorded.
 * - Records each applied file in `schema_migrations` (filename, sha256
 *   checksum, applied_at, baseline flag) and never runs a recorded file again.
 *   That is what keeps a re-run of migrate-009 from resetting TRACI methane
 *   and a re-run of migrate-016 from overwriting the Wood fuel factor.
 *   A recorded file whose checksum has changed is reported, not re-run.
 * - --baseline marks 009 through 025 as applied WITHOUT running them, for a
 *   database that already had them applied by hand. Run once, then run again
 *   without the flag to apply what is newer. --baseline-through=NNN moves the
 *   upper bound.
 * - Refuses any DATABASE_HOST other than 127.0.0.1 / localhost / ::1 unless
 *   --allow-remote is given AND the database name is typed back at an
 *   interactive prompt. With no terminal, a remote run is refused.
 *
 * Connection comes from DATABASE_HOST, DATABASE_PORT, DATABASE_USER,
 * DATABASE_PASSWORD, DATABASE_NAME. The password is passed to mysql through
 * MYSQL_PWD, never on the command line.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const FILE_RE = /^migrate-(\d{3})-[A-Za-z0-9._-]+\.sql$/;
const BASELINE_FROM = 9;
const BASELINE_THROUGH = 25;

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

/** @param {string | undefined | null} host */
export function isLocalHost(host) {
  const h = String(host ?? '').trim().toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1' || h === '[::1]';
}

/**
 * @param {ReturnType<typeof listMigrations>} files
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

/**
 * Files --baseline would mark: numbered within [from, through] and not recorded yet.
 * @param {ReturnType<typeof listMigrations>} files
 * @param {Map<string, string>} ledger
 */
export function baselineCandidates(files, ledger, from = BASELINE_FROM, through = BASELINE_THROUGH) {
  return files.filter((f) => f.number >= from && f.number <= through && !ledger.has(f.filename));
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const opts = {
    baseline: false,
    baselineThrough: BASELINE_THROUGH,
    dryRun: false,
    allowRemote: false,
    dir: REPO_ROOT,
  };
  for (const a of argv) {
    if (a === '--baseline') opts.baseline = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--allow-remote') opts.allowRemote = true;
    else if (a.startsWith('--dir=')) opts.dir = path.resolve(a.slice('--dir='.length));
    else if (a.startsWith('--baseline-through=')) {
      opts.baselineThrough = Number(a.slice('--baseline-through='.length));
      if (!Number.isInteger(opts.baselineThrough)) throw new Error(`Bad value: ${a}`);
    } else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// mysql CLI plumbing
// ---------------------------------------------------------------------------

/**
 * @param {{ host: string, port: string, user: string, password: string, database: string }} db
 * @param {string[]} extra
 * @param {string | undefined} input
 */
function mysql(db, extra, input) {
  const args = [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    '--default-character-set=utf8mb4',
    ...extra,
    db.database,
  ];
  const env = { ...process.env };
  if (db.password) env.MYSQL_PWD = db.password;
  else delete env.MYSQL_PWD;
  const r = spawnSync('mysql', args, { input, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw r.error;
  return r;
}

function sqlExec(db, sql) {
  const r = mysql(db, ['--batch', '--skip-column-names', '-e', sql], undefined);
  if (r.status !== 0) throw new Error(`mysql failed: ${r.stderr.trim()}`);
  return r.stdout;
}

const LEDGER_DDL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) NOT NULL PRIMARY KEY,
  checksum   CHAR(64)     NOT NULL,
  applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  baseline   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = marked applied by --baseline, not run by the runner'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

function readLedger(db) {
  sqlExec(db, LEDGER_DDL);
  const out = sqlExec(db, 'SELECT filename, checksum FROM schema_migrations ORDER BY filename');
  /** @type {Map<string, string>} */
  const ledger = new Map();
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [filename, checksum] = line.split('\t');
    ledger.set(filename, checksum);
  }
  return ledger;
}

function record(db, file, baseline) {
  if (!FILE_RE.test(file.filename) || !/^[0-9a-f]{64}$/.test(file.checksum)) {
    throw new Error(`Refusing to record an unexpected filename/checksum: ${file.filename}`);
  }
  sqlExec(
    db,
    `INSERT INTO schema_migrations (filename, checksum, baseline) VALUES ('${file.filename}', '${file.checksum}', ${baseline ? 1 : 0})`,
  );
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

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(String(/** @type {Error} */ (e).message));
    return 2;
  }
  const db = {
    host: (process.env.DATABASE_HOST || '127.0.0.1').trim(),
    port: (process.env.DATABASE_PORT || '3306').trim(),
    user: (process.env.DATABASE_USER || 'root').trim(),
    password: process.env.DATABASE_PASSWORD || '',
    database: (process.env.DATABASE_NAME || '').trim(),
  };
  if (!db.database) {
    console.error('DATABASE_NAME is not set. Run with: node --env-file=.env.local scripts/db/migrate.mjs');
    return 2;
  }

  if (!isLocalHost(db.host)) {
    if (!opts.allowRemote) {
      console.error(
        `Refusing to migrate ${db.database} on non-local host ${db.host}. This runner only touches 127.0.0.1/localhost unless --allow-remote is passed and confirmed interactively.`,
      );
      return 2;
    }
    if (!process.stdin.isTTY) {
      console.error(
        `Refusing --allow-remote for ${db.host}: the confirmation must be typed at an interactive terminal.`,
      );
      return 2;
    }
    const answer = await ask(
      `About to run migrations against REMOTE host ${db.host}, database ${db.database}.\nType the database name to continue: `,
    );
    if (String(answer).trim() !== db.database) {
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
  const ledger = readLedger(db);
  const plan = planMigrations(files, ledger);
  const where = `${db.database}@${db.host}:${db.port}`;

  for (const f of plan.changed) {
    console.warn(
      `WARNING: ${f.filename} changed since it was recorded on ${where} (checksum differs). It is NOT re-run; write a new numbered migration for any data change.`,
    );
  }

  if (opts.baseline) {
    const marks = baselineCandidates(files, ledger, BASELINE_FROM, opts.baselineThrough);
    for (const f of marks) {
      console.log(`${opts.dryRun ? 'would mark' : 'baseline'}  ${f.filename}`);
      if (!opts.dryRun) record(db, f, true);
    }
    console.log(
      `${marks.length} file(s) ${opts.dryRun ? 'would be marked' : 'marked'} applied without running on ${where}. Run again without --baseline to apply newer migrations.`,
    );
    return 0;
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
    const r = mysql(db, [], readFileSync(f.path, 'utf8'));
    if (r.stdout.trim()) console.log(r.stdout.replace(/^/gm, '    '));
    if (r.status !== 0) {
      console.error(`FAILED    ${f.filename}\n${r.stderr.trim()}\nStopped. ${f.filename} was not recorded; later files were not run.`);
      return 1;
    }
    record(db, f, false);
  }
  console.log(`${opts.dryRun ? 'Would apply' : 'Applied'} ${plan.pending.length} migration(s) on ${where}.`);
  return 0;
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
