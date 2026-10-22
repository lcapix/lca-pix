#!/usr/bin/env node
/**
 * Compares a Postgres database with the MySQL one it was ported from (the
 * port, P0; reused on the real data in P4 and on Neon in P5). Every table,
 * column (type, null, default, identity, collation), primary key, index,
 * foreign key, check and ON UPDATE column must match under the rules in
 * types.mjs. Prints each difference; exit 0 only when there are none.
 *
 *   MYSQL_URL=mysql://root@127.0.0.1:3307/lcapix_t_pgsource \
 *   PG_URL=postgres://postgres@127.0.0.1:5433/lcapix_p0 \
 *     node scripts/db/pg/compare-schema.mjs
 *
 * Reads names and definitions only, never rows.
 */
import mysql from 'mysql2/promise';
import pg from 'pg';
import { pgConfigFromUrl } from '../migrate.mjs';
import { STRING, enumValues, indexName, pgDefault, pgType } from './types.mjs';

const MYSQL_URL = process.env.MYSQL_URL;
const PG_URL = process.env.PG_URL;
if (!MYSQL_URL || !PG_URL) {
  console.error('Set MYSQL_URL and PG_URL.');
  process.exit(2);
}
const myDb = new URL(MYSQL_URL).pathname.slice(1);
const my = await mysql.createConnection(MYSQL_URL);
const pgc = new pg.Client(pgConfigFromUrl(PG_URL));
await pgc.connect();
const myRows = async (sql) => (await my.query(sql, [myDb]))[0];
const pgRows = async (sql) => (await pgc.query(sql)).rows;

const diffs = [];
const differ = (what) => diffs.push(what);

// Tables.
const myTables = (await myRows(`SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`)).map((r) => r.t).sort();
const pgTables = (await pgRows(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`)).map((r) => r.t).sort();
for (const t of myTables) if (!pgTables.includes(t)) differ(`table ${t}: missing in Postgres`);
for (const t of pgTables) if (!myTables.includes(t)) differ(`table ${t}: only in Postgres`);

// Columns.
const myCols = await myRows(`SELECT * FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?`);
const pgCols = await pgRows(`
  SELECT c.table_name, c.column_name, format_type(a.atttypid, a.atttypmod) AS type, c.is_nullable,
         c.column_default, c.is_identity, c.collation_name
    FROM information_schema.columns c
    JOIN pg_attribute a ON a.attrelid = (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass AND a.attname = c.column_name
   WHERE c.table_schema = 'public'`);
const pgCol = new Map(pgCols.map((c) => [`${c.table_name}.${c.column_name}`, c]));
for (const c of myCols) {
  const key = `${c.TABLE_NAME}.${c.COLUMN_NAME}`;
  const p = pgCol.get(key);
  if (!p) {
    differ(`column ${key}: missing in Postgres`);
    continue;
  }
  pgCol.delete(key);
  if (p.type !== pgType(c)) differ(`column ${key}: type ${p.type}, expected ${pgType(c)}`);
  if (p.is_nullable !== c.IS_NULLABLE) differ(`column ${key}: nullable ${p.is_nullable}, MySQL ${c.IS_NULLABLE}`);
  const autoInc = /auto_increment/i.test(c.EXTRA);
  if ((p.is_identity === 'YES') !== autoInc) differ(`column ${key}: identity ${p.is_identity}, MySQL auto_increment ${autoInc}`);
  if (!autoInc) {
    const want = pgDefault(c);
    const got = p.column_default === null ? null : String(p.column_default).replace(/::[a-z ]+(\(\d+(,\d+)?\))?$/i, '');
    if (String(want) !== String(got)) differ(`column ${key}: default ${got}, expected ${want}`);
  }
  if (STRING.has(c.DATA_TYPE) && p.collation_name !== 'ci') differ(`column ${key}: collation ${p.collation_name}, expected ci`);
}
for (const key of pgCol.keys()) differ(`column ${key}: only in Postgres`);

// Enum values as CHECKs: each enum column has a check naming every value.
const pgChecks = await pgRows(`
  SELECT rel.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
   WHERE n.nspname = 'public' AND con.contype = 'c'`);
for (const c of myCols.filter((c) => c.DATA_TYPE === 'enum')) {
  const ok = pgChecks.some(
    (k) =>
      k.table_name === c.TABLE_NAME &&
      k.def.includes(c.COLUMN_NAME) &&
      enumValues(c.COLUMN_TYPE).every((v) => k.def.includes(`'${v}'`)),
  );
  if (!ok) differ(`column ${c.TABLE_NAME}.${c.COLUMN_NAME}: no CHECK listing its enum values`);
}

// Named CHECK constraints.
const myChecks = await myRows(`
  SELECT tc.TABLE_NAME AS t, cc.CONSTRAINT_NAME AS n FROM information_schema.CHECK_CONSTRAINTS cc
    JOIN information_schema.TABLE_CONSTRAINTS tc ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
   WHERE cc.CONSTRAINT_SCHEMA = ?`);
for (const k of myChecks) if (!pgChecks.some((p) => p.table_name === k.t && p.conname === k.n)) differ(`check ${k.t}.${k.n}: missing in Postgres`);

// Primary keys and indexes.
const myIdx = await myRows(`SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`);
const pgIdx = await pgRows(`
  SELECT t.relname AS table_name, i.relname AS index_name, ix.indisunique AS uniq, ix.indisprimary AS prim,
         array_to_string(array(SELECT a.attname FROM unnest(ix.indkey) WITH ORDINALITY k(n, o)
                                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.n ORDER BY k.o), ',') AS cols
    FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public'`);
const myIndexes = new Map();
for (const s of myIdx) {
  const k = `${s.TABLE_NAME}|${s.INDEX_NAME}`;
  if (!myIndexes.has(k)) myIndexes.set(k, { table: s.TABLE_NAME, name: s.INDEX_NAME, unique: Number(s.NON_UNIQUE) === 0, cols: [] });
  myIndexes.get(k).cols.push(s.COLUMN_NAME);
}
for (const i of myIndexes.values()) {
  const p = i.name === 'PRIMARY'
    ? pgIdx.find((x) => x.table_name === i.table && x.prim)
    : pgIdx.find((x) => x.table_name === i.table && x.index_name === indexName(i.table, i.name));
  const label = `index ${i.table}.${i.name}`;
  if (!p) {
    differ(`${label}: missing in Postgres`);
    continue;
  }
  if (p.cols !== i.cols.join(',')) differ(`${label}: columns (${p.cols}), MySQL (${i.cols.join(',')})`);
  if (p.uniq !== i.unique) differ(`${label}: unique ${p.uniq}, MySQL ${i.unique}`);
}
if (pgIdx.length !== myIndexes.size) differ(`indexes: ${pgIdx.length} in Postgres, ${myIndexes.size} in MySQL`);

// Foreign keys.
const myFk = await myRows(`
  SELECT k.TABLE_NAME AS t, k.CONSTRAINT_NAME AS n, GROUP_CONCAT(k.COLUMN_NAME ORDER BY k.ORDINAL_POSITION) AS cols,
         k.REFERENCED_TABLE_NAME AS rt, GROUP_CONCAT(k.REFERENCED_COLUMN_NAME ORDER BY k.ORDINAL_POSITION) AS rcols, r.DELETE_RULE AS del
    FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
   WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
   GROUP BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.REFERENCED_TABLE_NAME, r.DELETE_RULE`);
const pgFk = await pgRows(`
  SELECT rel.relname AS t, con.conname AS n, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace n ON n.oid = rel.relnamespace
   WHERE n.nspname = 'public' AND con.contype = 'f'`);
for (const f of myFk) {
  const p = pgFk.find((x) => x.t === f.t && x.n === f.n);
  if (!p) {
    differ(`foreign key ${f.t}.${f.n}: missing in Postgres`);
    continue;
  }
  const quote = (list) => String(list).split(',').map((c) => c).join(', ');
  const del = f.del === 'NO ACTION' ? 'RESTRICT' : f.del;
  const want = `FOREIGN KEY (${quote(f.cols)}) REFERENCES ${f.rt}(${quote(f.rcols)}) ON DELETE ${del}`;
  if (p.def.replace(/"/g, '') !== want) differ(`foreign key ${f.t}.${f.n}: ${p.def}, expected ${want}`);
}
if (pgFk.length !== myFk.length) differ(`foreign keys: ${pgFk.length} in Postgres, ${myFk.length} in MySQL`);

// ON UPDATE CURRENT_TIMESTAMP columns: one trigger each.
const onUpdate = myCols.filter((c) => /on update CURRENT_TIMESTAMP/i.test(c.EXTRA)).map((c) => c.TABLE_NAME).sort();
const triggers = (await pgRows(`SELECT c.relname AS t FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid WHERE NOT tg.tgisinternal AND tg.tgname LIKE '%set_updated_at'`)).map((r) => r.t).sort();
if (onUpdate.join() !== triggers.join()) differ(`updated_at triggers on (${triggers}), MySQL ON UPDATE on (${onUpdate})`);

await my.end();
await pgc.end();
console.log(
  `${myTables.length} tables, ${myCols.length} columns, ${myIndexes.size} indexes, ${myFk.length} foreign keys, ${myChecks.length} checks, ${onUpdate.length} ON UPDATE columns compared`,
);
if (diffs.length) {
  console.log(`${diffs.length} difference(s):`);
  for (const d of diffs) console.log(`  ${d}`);
  process.exit(1);
}
console.log('0 differences');
