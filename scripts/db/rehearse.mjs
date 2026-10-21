#!/usr/bin/env node
/**
 * Rehearse a release's migrations on a copy of a real database, locally,
 * before anyone runs them on the real one (docs/release/EDUCATION_RELEASE_RUNBOOK.md).
 *
 *   node scripts/db/rehearse.mjs <dump.sql> --from=033 [--baseline-through=025] [--keep]
 *
 * 1. Restores the dump into a throwaway lcapix_t_rehearse_* database (local
 *    MySQL only, as fresh.mjs: DATABASE_HOST/PORT/USER/PASSWORD; never a
 *    remote host).
 * 2. Brings the copy to the state the real database is in before the release,
 *    by the path the real one took: --baseline-through=NNN first marks 009 to
 *    NNN as applied without running them (as migrate.mjs --baseline did on
 *    production, whose copy already had them), then every numbered migration
 *    before --from is applied through migrate.mjs and recorded.
 * 3. Counts every table's rows and takes CHECKSUM TABLE of each.
 * 4. Applies the release's migrations (--from onward) through migrate.mjs.
 * 5. Says what changed per table (rows added or removed; new tables).
 * 6. Idempotency: migrate.mjs again must have nothing to apply; then each
 *    release file is run again by hand and no table's checksum may move.
 * 7. Compares the schema (columns with type, null, default; indexes) with a
 *    database built from nothing by fresh.mjs, the one every test suite runs
 *    on. A difference means the real database would not be the one tested.
 *
 * Prints counts and names only, never row contents (a production dump holds
 * people's data). Drops its databases at the end unless --keep.
 * Exit 0 when every check holds, 1 otherwise.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { isLocalHost, listMigrations } from './migrate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const dump = args.find((a) => !a.startsWith('--'));
const from = Number((args.find((a) => a.startsWith('--from=')) ?? '').slice('--from='.length));
const keep = args.includes('--keep');
const baselineArg = args.find((a) => a.startsWith('--baseline-through='));
const baselineThrough = baselineArg ? Number(baselineArg.slice('--baseline-through='.length)) : null;
if (baselineThrough !== null && (!Number.isInteger(baselineThrough) || baselineThrough >= from)) {
  console.error('rehearse: --baseline-through must be a migration number below --from');
  process.exit(2);
}
if (!dump || !Number.isInteger(from) || from <= 0) {
  console.error('usage: node scripts/db/rehearse.mjs <dump.sql> --from=NNN [--keep]');
  process.exit(2);
}

const db = {
  host: (process.env.DATABASE_HOST || '127.0.0.1').trim(),
  port: (process.env.DATABASE_PORT || '3306').trim(),
  user: (process.env.DATABASE_USER || 'root').trim(),
  password: process.env.DATABASE_PASSWORD || '',
};
if (!isLocalHost(db.host)) {
  console.error(`rehearse: local MySQL only, not ${db.host}`);
  process.exit(2);
}

const stamp = Date.now().toString(36);
const NAME = `lcapix_t_rehearse_${stamp}`;
const REF = `lcapix_t_reference_${stamp}`;
const say = (s) => console.log(s);
let failures = 0;
const fail = (s) => {
  failures++;
  console.log(`FAIL  ${s}`);
};

function sh(cmd, argv, opts = {}) {
  const env = { ...process.env, ...(opts.env ?? {}) };
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, env, input: opts.input });
  if (r.error) throw r.error;
  return r;
}
function mysqlCli(database, input) {
  const env = db.password ? { MYSQL_PWD: db.password } : {};
  if (!db.password) delete process.env.MYSQL_PWD;
  return sh('mysql', [`--host=${db.host}`, `--port=${db.port}`, `--user=${db.user}`, '--default-character-set=utf8mb4', database], { input, env });
}
function migrate(database, dir, extra = []) {
  return sh(process.execPath, [path.join(HERE, 'migrate.mjs'), `--dir=${dir}`, ...extra], {
    env: { DATABASE_HOST: db.host, DATABASE_PORT: db.port, DATABASE_USER: db.user, DATABASE_PASSWORD: db.password, DATABASE_NAME: database },
  });
}

const conn = await mysql.createConnection({ host: db.host, port: Number(db.port), user: db.user, password: db.password, multipleStatements: false });
const tables = async (database) =>
  (await conn.query('SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ? ORDER BY TABLE_NAME', [database, 'BASE TABLE']))[0].map((r) => r.t);
async function state(database) {
  const out = {};
  for (const t of await tables(database)) {
    const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${database}\`.\`${t}\``);
    const [[c]] = await conn.query(`CHECKSUM TABLE \`${database}\`.\`${t}\``);
    out[t] = { rows: Number(n), checksum: String(c.Checksum) };
  }
  return out;
}
async function schema(database) {
  const [cols] = await conn.query(
    `SELECT TABLE_NAME t, COLUMN_NAME c, COLUMN_TYPE ty, IS_NULLABLE n, COLUMN_DEFAULT d
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, COLUMN_NAME`,
    [database],
  );
  const [idx] = await conn.query(
    `SELECT TABLE_NAME t, INDEX_NAME i, NON_UNIQUE u, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) cols
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE`,
    [database],
  );
  return {
    columns: new Map(cols.map((r) => [`${r.t}.${r.c}`, `${r.ty} ${r.n === 'YES' ? 'NULL' : 'NOT NULL'} default=${r.d}`])),
    indexes: new Map(idx.map((r) => [`${r.t}.${r.i}`, `${r.u ? '' : 'unique '}(${r.cols})`])),
  };
}

const all = listMigrations(REPO);
const before = all.filter((m) => m.number < from);
const release = all.filter((m) => m.number >= from);
const stage = mkdtempSync(path.join(tmpdir(), 'lcapix-rehearse-'));
for (const m of before) symlinkSync(m.path, path.join(stage, m.filename));

try {
  // 1. Restore.
  await conn.query(`CREATE DATABASE \`${NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const t0 = performance.now();
  const restored = mysqlCli(NAME, readFileSync(dump, 'utf8'));
  if (restored.status !== 0) throw new Error(`restore failed: ${restored.stderr.trim().slice(0, 300)}`);
  const start = await state(NAME);
  say(`restored ${path.basename(dump)} into ${NAME} in ${Math.round(performance.now() - t0)} ms: ${Object.keys(start).length} tables, ${Object.values(start).reduce((n, s) => n + s.rows, 0)} rows`);

  // 2. Up to the release, by the real database's path.
  if (baselineThrough !== null) {
    const base = migrate(NAME, stage, ['--baseline', `--baseline-through=${baselineThrough}`]);
    say(base.stdout.trim().split('\n').slice(-1).map((l) => `  ${l}`).join('\n'));
    if (base.status !== 0) throw new Error(`--baseline failed: ${base.stderr.trim().slice(0, 300)}`);
  }
  const pre = migrate(NAME, stage);
  say(pre.stdout.trim().split('\n').map((l) => `  ${l}`).join('\n'));
  if (pre.status !== 0) throw new Error(`migrations before ${from} failed: ${pre.stderr.trim().slice(0, 500)}`);

  // 3. The state the release starts from.
  const mid = await state(NAME);
  for (const [t, s] of Object.entries(start)) {
    if (mid[t] && mid[t].rows < s.rows) fail(`${t}: migrations before ${from} removed ${s.rows - mid[t].rows} row(s)`);
  }

  // 4. The release.
  const t1 = performance.now();
  const rel = migrate(NAME, REPO);
  say(rel.stdout.trim().split('\n').map((l) => `  ${l}`).join('\n'));
  if (rel.status !== 0) throw new Error(`release migrations failed: ${rel.stderr.trim().slice(0, 500)}`);
  say(`release migrations (${release.map((m) => String(m.number).padStart(3, '0')).join(', ')}) applied in ${Math.round(performance.now() - t1)} ms`);

  // 5. What the release changed.
  const after = await state(NAME);
  for (const t of Object.keys(after).sort()) {
    if (!mid[t]) say(`  new table ${t}: ${after[t].rows} row(s)`);
    else if (after[t].rows !== mid[t].rows) {
      const d = after[t].rows - mid[t].rows;
      say(`  ${t}: ${d > 0 ? '+' : ''}${d} row(s) (${mid[t].rows} → ${after[t].rows})`);
      if (d < 0) fail(`${t}: the release removed ${-d} row(s)`);
    }
  }
  for (const t of Object.keys(mid)) if (!after[t]) fail(`table ${t} is gone after the release`);

  // 6. Idempotency.
  const again = migrate(NAME, REPO);
  if (!/Nothing to apply/.test(again.stdout)) fail(`a second migrate.mjs run applied something:\n${again.stdout}`);
  else say('second migrate.mjs run: nothing to apply');
  for (const m of release) {
    const r = mysqlCli(NAME, readFileSync(m.path, 'utf8'));
    if (r.status !== 0) fail(`${m.filename} run a second time failed: ${r.stderr.trim().slice(0, 300)}`);
  }
  const twice = await state(NAME);
  const moved = Object.keys(after).filter((t) => !twice[t] || twice[t].checksum !== after[t].checksum || twice[t].rows !== after[t].rows);
  if (moved.length) fail(`running the release files again changed: ${moved.join(', ')}`);
  else say(`each release file run again by hand: no table changed (${Object.keys(after).length} checksums)`);

  // 7. Same schema as the database the tests run on.
  const fresh = sh(process.execPath, [path.join(HERE, 'fresh.mjs'), `--name=${REF}`], {
    env: { DATABASE_HOST: db.host, DATABASE_PORT: db.port, DATABASE_USER: db.user, DATABASE_PASSWORD: db.password },
  });
  if (fresh.status !== 0) throw new Error(`fresh.mjs failed: ${fresh.stderr.trim().slice(0, 300)}`);
  const [a, b] = [await schema(NAME), await schema(REF)];
  const diffs = [];
  for (const kind of ['columns', 'indexes']) {
    for (const [k, v] of b[kind]) if (!a[kind].has(k)) diffs.push(`missing ${kind.slice(0, -1)} ${k} ${v}`);
      else if (a[kind].get(k) !== v) diffs.push(`${kind.slice(0, -1)} ${k}: ${a[kind].get(k)}  (tested: ${v})`);
    for (const [k, v] of a[kind]) if (!b[kind].has(k)) diffs.push(`extra ${kind.slice(0, -1)} ${k} ${v}`);
  }
  say(`schema against a database built from nothing: ${diffs.length} difference(s)`);
  for (const d of diffs) say(`  ${d}`);
  if (diffs.some((d) => d.startsWith('missing') || d.startsWith('column'))) fail('the migrated copy lacks or changes a column or index the tested schema has');
} catch (e) {
  fail(e.message);
} finally {
  rmSync(stage, { recursive: true, force: true });
  if (!keep) {
    await conn.query(`DROP DATABASE IF EXISTS \`${NAME}\``);
    await conn.query(`DROP DATABASE IF EXISTS \`${REF}\``);
  } else say(`kept ${NAME} and ${REF}`);
  await conn.end();
}
say(failures ? `${failures} check(s) failed` : 'every check held');
process.exit(failures ? 1 : 0);
