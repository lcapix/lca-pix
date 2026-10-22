#!/usr/bin/env node
/**
 * Rehearse pending migrations on a copy of a real database, locally, before
 * anyone runs them on the real one (docs/release/EDUCATION_RELEASE_RUNBOOK.md).
 *
 *   node scripts/db/rehearse.mjs --from=<local database> [--keep]
 *
 * The source is a local Postgres database holding a copy of production: a
 * pg_dump of Neon restored locally, or the load's own copy. It is never
 * touched: the rehearsal runs on lcapix_t_rehearse_*, made from it with
 * CREATE DATABASE ... TEMPLATE (scripts/db/fresh.mjs --from).
 *
 * 1. Counts every table's rows and takes a fingerprint of each (md5 over
 *    every row, in a fixed order).
 * 2. Applies the pending migrations (db/pg/migrations) through migrate.mjs.
 * 3. Says what changed per table: rows added or removed, new tables.
 *    A table that lost rows fails the rehearsal.
 * 4. Idempotency: migrate.mjs again must have nothing to apply.
 * 5. The schema afterwards must equal a database built from nothing by
 *    fresh.mjs, the one every test suite runs on: a difference means the real
 *    database would not be the one tested.
 *
 * Prints counts and names only, never row contents (a production copy holds
 * people's data). Drops its databases at the end unless --keep.
 * Exit 0 when every check holds, 1 otherwise.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createFreshDatabase, dropDatabase, newName, serverFromEnv } from './fresh.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const from = args.find((a) => a.startsWith('--from='))?.slice('--from='.length);
const keep = args.includes('--keep');
if (!from) {
  console.error('usage: rehearse.mjs --from=<local database> [--keep]');
  process.exit(2);
}

const server = serverFromEnv();
const log = (s) => console.log(s);
const open = async (database) => {
  const c = new pg.Client({ host: server.host, port: Number(server.port), user: server.user, password: server.password || undefined, database });
  await c.connect();
  return c;
};

/** Row count and fingerprint of every table. */
async function tables(database) {
  const c = await open(database);
  try {
    const names = (await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`)).rows.map((r) => r.table_name);
    const out = {};
    for (const t of names) {
      const r = (await c.query(`SELECT count(*)::int AS n, md5(string_agg(x::text, '|' ORDER BY x::text COLLATE "C")) AS h FROM "${t}" x`)).rows[0];
      out[t] = { n: r.n, h: r.h };
    }
    return out;
  } finally {
    await c.end();
  }
}

/** The schema as sorted lines: columns, constraints, indexes, triggers, functions. */
async function schema(database) {
  const c = await open(database);
  try {
    const q = async (sql) => (await c.query(sql)).rows.map((r) => Object.values(r).join(' | '));
    return [
      ...(await q(`SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default, collation_name
                     FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1, 2`)),
      ...(await q(`SELECT rel.relname, con.conname, pg_get_constraintdef(con.oid) FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
                     JOIN pg_namespace n ON n.oid = rel.relnamespace WHERE n.nspname = 'public' ORDER BY 1, 2`)),
      ...(await q(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2`)),
      ...(await q(`SELECT c.relname, t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE NOT t.tgisinternal ORDER BY 1, 2`)),
      ...(await q(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' ORDER BY 1`)),
    ];
  }
  finally {
    await c.end();
  }
}

function migrate(database) {
  const r = spawnSync(process.execPath, [path.join(HERE, 'migrate.mjs')], {
    env: { ...process.env, DATABASE_URL: '', DATABASE_HOST: server.host, DATABASE_PORT: server.port, DATABASE_USER: server.user, DATABASE_PASSWORD: server.password, DATABASE_NAME: database },
    encoding: 'utf8',
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const copy = await createFreshDatabase({ name: `lcapix_t_rehearse_${newName().slice('lcapix_t_'.length)}`, fromTemplate: from, migrate: false, server, log: () => {} });
const fresh = await createFreshDatabase({ server, log: () => {} });
let failed = 0;
const fail = (s) => {
  failed++;
  log(`FAIL  ${s}`);
};
try {
  log(`rehearsal on ${copy}, a copy of ${from}`);
  const before = await tables(copy);
  const t0 = Date.now();
  const run = migrate(copy);
  log(run.out.trim().replace(/^/gm, '  '));
  if (run.status !== 0) fail('migrate.mjs failed on the copy');
  log(`  in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const after = await tables(copy);
  for (const [t, b] of Object.entries(before)) {
    const a = after[t];
    if (!a) fail(`${t}: table gone`);
    else if (a.n < b.n) fail(`${t}: ${b.n - a.n} row(s) removed`);
    else if (a.n > b.n) log(`  ${t}: ${a.n - b.n} row(s) added`);
    else if (a.h !== b.h) log(`  ${t}: rows changed (same count)`);
  }
  for (const t of Object.keys(after)) if (!before[t]) log(`  ${t}: new table, ${after[t].n} row(s)`);
  const again = migrate(copy);
  if (again.status !== 0 || !/Nothing to apply/.test(again.out)) fail('a second migrate.mjs run applied something or failed');
  const [mine, tested] = [await schema(copy), await schema(fresh)];
  const diff = [...mine.filter((l) => !tested.includes(l)).map((l) => `copy only: ${l}`), ...tested.filter((l) => !mine.includes(l)).map((l) => `fresh only: ${l}`)];
  if (diff.length) {
    fail(`the schema differs from a fresh build in ${diff.length} line(s)`);
    for (const d of diff.slice(0, 20)) log(`  ${d}`);
  } else log('  schema: the same as a fresh build');
} finally {
  if (keep) log(`kept ${copy} and ${fresh}`);
  else {
    await dropDatabase(copy, server);
    await dropDatabase(fresh, server);
  }
}
log(failed ? `${failed} check(s) failed` : 'every check held');
process.exit(failed ? 1 : 0);
