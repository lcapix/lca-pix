#!/usr/bin/env node
/**
 * Copies every row of a MySQL database into a Postgres database built from
 * db/pg/000-schema.sql, then proves the copy (the port, P2 and P4).
 *
 *   MYSQL_URL=mysql://root@127.0.0.1:3307/lcapix_t_source \
 *   PG_URL=postgres://postgres@127.0.0.1:5433/lcapix_target \
 *     node scripts/db/pg/copy-from-mysql.mjs [--tables=a,b] [--create-schema] [--record-baseline] [--allow-remote-target]
 *
 * - The target's tables must be empty: nothing is merged or overwritten.
 *   --create-schema applies db/pg/000-schema.sql first to a target with no
 *   tables at all (a new Neon database), in the same transaction as the copy:
 *   the target ends up fully loaded or exactly as it was.
 * - Tables go parents first (foreign keys); rows of a table that points at
 *   itself (a step's parent step, a case's parent case) go parents first too.
 *   Ids are kept, and each identity counter is set past the largest id, so the
 *   next insert does not collide.
 * - MySQL is read in UTC, so a timestamp cannot shift with the machine's zone.
 * - One transaction on Postgres: a failure leaves the target as it was.
 * - schema_migrations is not copied: the MySQL ledger means nothing to
 *   Postgres. --record-baseline records db/pg/000-schema.sql and
 *   001-reference.sql as applied (the one-time load of production).
 * - Then the proof: for every table, the same row count, and the same
 *   fingerprint (sha256 over every row, sorted by primary key, each value
 *   normalised by type) on both sides. Exit 0 only when every table matches.
 * - A non-local Postgres (Neon) needs --allow-remote-target and the database
 *   name typed back at a terminal.
 * - --verify-only copies nothing and runs only the proof (read-only on both
 *   sides, so no confirmation): for checking a load whose output was lost.
 *
 * Prints table names and counts only, never row contents.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { BASELINE_FILES, baselineEntries, isLocalHost, pgConfigFromUrl } from '../migrate.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const SKIP = new Set(['schema_migrations']);
const BATCH = 500;

const MYSQL_URL = process.env.MYSQL_URL;
const PG_URL = process.env.PG_URL;
if (!MYSQL_URL || !PG_URL) {
  console.error('Set MYSQL_URL (the source) and PG_URL (the target).');
  process.exit(2);
}
const target = new URL(PG_URL);
const targetDb = decodeURIComponent(target.pathname.slice(1));
const verifyOnly = flag('--verify-only');
if (!isLocalHost(target.hostname) && !verifyOnly) {
  if (!flag('--allow-remote-target') || !process.stdin.isTTY) {
    console.error(`Refusing to load ${target.hostname}: pass --allow-remote-target and confirm at a terminal.`);
    process.exit(2);
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await new Promise((resolve) => rl.question(`About to load REMOTE ${target.hostname}, database ${targetDb}.\nType the database name to continue: `, resolve));
  rl.close();
  if (String(answer).trim() !== targetDb) {
    console.error('Confirmation did not match. Nothing was copied.');
    process.exit(2);
  }
}

const my = await mysql.createConnection({ uri: MYSQL_URL, dateStrings: true, supportBigNumbers: true, timezone: 'Z' });
await my.query(`SET time_zone = '+00:00'`);
const pgc = new pg.Client(pgConfigFromUrl(PG_URL));
await pgc.connect();
const pgRows = async (sql, params = []) => (await pgc.query(sql, params)).rows;

// A brand-new target: the schema goes in inside the transaction the copy uses.
let inTransaction = false;
if (flag('--create-schema') && !verifyOnly) {
  const [{ n }] = await pgRows(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`);
  if (n === 0) {
    await pgc.query('BEGIN');
    inTransaction = true;
    try {
      await pgc.query(readFileSync(BASELINE_FILES[0], 'utf8'));
    } catch (e) {
      await pgc.query('ROLLBACK').catch(() => {});
      console.error(`schema failed, nothing kept: ${e?.message ?? e}`);
      await my.end();
      await pgc.end();
      process.exit(1);
    }
    console.log('schema    db/pg/000-schema.sql (in the copy\'s transaction)');
  } else {
    console.log(`schema    already there (${n} tables): not applied again`);
  }
}

// Tables and columns, from the target.
const only = value('--tables')?.split(',').map((s) => s.trim()).filter(Boolean);
const allTables = (await pgRows(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`)).map((r) => r.table_name);
const tables = allTables.filter((t) => !SKIP.has(t) && (!only || only.includes(t)));
const cols = await pgRows(`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`);
const colsOf = (t) => cols.filter((c) => c.table_name === t);
const pk = await pgRows(`
  SELECT rel.relname AS t, a.attname AS c, k.n
    FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY k(attnum, n)
    JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = k.attnum
   WHERE ns.nspname = 'public' AND con.contype = 'p' ORDER BY rel.relname, k.n`);
const pkOf = (t) => pk.filter((r) => r.t === t).map((r) => r.c);
const fks = await pgRows(`
  SELECT rel.relname AS t, ref.relname AS r, a.attname AS c
    FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute a ON a.attrelid = rel.oid AND a.attnum = con.conkey[1]
   WHERE ns.nspname = 'public' AND con.contype = 'f'`);

// Parents first.
const ordered = [];
const seen = new Set();
const visit = (t, path = new Set()) => {
  if (seen.has(t) || path.has(t)) return;
  path.add(t);
  for (const f of fks.filter((f) => f.t === t && f.r !== t)) if (tables.includes(f.r)) visit(f.r, path);
  seen.add(t);
  ordered.push(t);
};
for (const t of tables) visit(t);

// Values as Postgres takes them.
const toPg = (v, type) => {
  if (v === null || v === undefined) return null;
  if (type === 'jsonb') return JSON.stringify(v);
  if (type === 'timestamp with time zone') return `${v}+00`;
  return v;
};

/** Rows of a self-referencing table, each after the row it points at. */
function parentsFirst(rows, idCol, parentCols) {
  if (!parentCols.length) return rows;
  const byId = new Map(rows.map((r) => [String(r[idCol]), r]));
  const out = [];
  const done = new Set();
  const place = (r, guard = new Set()) => {
    const id = String(r[idCol]);
    if (done.has(id) || guard.has(id)) return;
    guard.add(id);
    for (const c of parentCols) {
      const p = r[c] === null || r[c] === undefined ? null : byId.get(String(r[c]));
      if (p) place(p, guard);
    }
    done.add(id);
    out.push(r);
  };
  for (const r of rows) place(r);
  return out;
}

const counts = {};
if (!verifyOnly) {
if (!inTransaction) await pgc.query('BEGIN');
try {
  for (const t of ordered) {
    const [{ n }] = await pgRows(`SELECT count(*)::int AS n FROM "${t}"`);
    if (n > 0) throw new Error(`${t} already has ${n} row(s) on the target: copy only into an empty database`);
  }
  for (const t of ordered) {
    const c = colsOf(t);
    const keys = pkOf(t);
    const [srcRows] = await my.query(`SELECT * FROM \`${t}\`${keys.length ? ` ORDER BY ${keys.map((k) => `\`${k}\``).join(', ')}` : ''}`);
    const self = fks.filter((f) => f.t === t && f.r === t).map((f) => f.c);
    const rows = parentsFirst(srcRows, keys[0], self);
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const values = [];
      const tuples = chunk.map((r) => `(${c.map((col) => {
        values.push(toPg(r[col.column_name], col.data_type));
        return `$${values.length}`;
      }).join(', ')})`);
      await pgc.query(`INSERT INTO "${t}" (${c.map((col) => `"${col.column_name}"`).join(', ')}) VALUES ${tuples.join(', ')}`, values);
    }
    counts[t] = rows.length;
  }
  // Identity counters past the largest id.
  for (const t of ordered) {
    const id = cols.find((c) => c.table_name === t && pkOf(t).length === 1 && c.column_name === pkOf(t)[0]);
    const seq = id ? (await pgRows(`SELECT pg_get_serial_sequence($1, $2) AS s`, [`"${t}"`, id.column_name]))[0].s : null;
    if (seq) await pgc.query(`SELECT setval($1, GREATEST((SELECT COALESCE(MAX("${id.column_name}"), 0) FROM "${t}"), 1), (SELECT COUNT(*) > 0 FROM "${t}"))`, [seq]);
  }
  if (flag('--record-baseline')) {
    for (const b of baselineEntries()) {
      await pgc.query(`INSERT INTO schema_migrations (filename, checksum, baseline) VALUES ($1, $2, 1)`, [b.filename, b.checksum]);
    }
  }
  await pgc.query('COMMIT');
} catch (e) {
  await pgc.query('ROLLBACK');
  console.error(`copy failed, nothing kept: ${e?.message ?? e}`);
  await my.end();
  await pgc.end();
  process.exit(1);
}
}

// The proof: row counts and a fingerprint per table, both sides read again.
const canon = (v) =>
  v === null || typeof v !== 'object' ? v : Array.isArray(v) ? v.map(canon) : Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
const norm = (v, type) => {
  if (v === null || v === undefined) return null;
  if (type === 'jsonb') return JSON.stringify(canon(typeof v === 'string' ? JSON.parse(v) : v));
  if (type === 'double precision' || type === 'real') return Number(v);
  if (type === 'integer' || type === 'smallint' || type === 'bigint') return Number(v);
  return String(v);
};
async function fingerprint(side, t) {
  const c = colsOf(t);
  const keys = pkOf(t);
  let rows;
  if (side === 'mysql') {
    [rows] = await my.query(`SELECT * FROM \`${t}\``);
  } else {
    const list = c.map((col) =>
      col.data_type === 'timestamp with time zone'
        ? `to_char("${col.column_name}" AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS "${col.column_name}"`
        : col.data_type === 'date' || col.data_type === 'numeric'
          ? `"${col.column_name}"::text AS "${col.column_name}"`
          : `"${col.column_name}"`,
    );
    rows = await pgRows(`SELECT ${list.join(', ')} FROM "${t}"`);
  }
  const lines = rows.map((r) => JSON.stringify(c.map((col) => norm(r[col.column_name], col.data_type))));
  const order = (r) => JSON.stringify(keys.map((k) => norm(r[k], c.find((x) => x.column_name === k)?.data_type)));
  const sorted = rows.map((r, i) => [order(r), lines[i]]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { n: rows.length, hash: createHash('sha256').update(sorted.map((x) => x[1]).join('\n')).digest('hex') };
}

let bad = 0;
for (const t of ordered) {
  const a = await fingerprint('mysql', t);
  const b = await fingerprint('pg', t);
  const ok = a.n === b.n && a.hash === b.hash;
  if (!ok) bad++;
  console.log(`${ok ? 'same     ' : 'DIFFERENT'} ${t.padEnd(24)} ${String(a.n).padStart(6)} rows${ok ? '' : ` (Postgres ${b.n})`}`);
}
await my.end();
await pgc.end();
console.log(bad ? `${bad} table(s) differ` : `${ordered.length} tables copied, every row count and fingerprint the same`);
process.exit(bad ? 1 : 0);
