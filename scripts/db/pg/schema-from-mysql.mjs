#!/usr/bin/env node
/**
 * Writes the Postgres schema that matches a MySQL database (the port to
 * Postgres, stage P0). Run once against a database built by fresh.mjs at the
 * last MySQL migration; its output is db/pg/000-schema.sql, which is then
 * read by a person and kept. Kept in the repo to show how that file was made.
 *
 *   DATABASE_HOST=127.0.0.1 DATABASE_PORT=3307 DATABASE_USER=root DATABASE_PASSWORD= \
 *     node scripts/db/pg/schema-from-mysql.mjs lcapix_t_pgsource > db/pg/000-schema.sql
 *
 * What it carries over on purpose, not just by type:
 * - Text compares as MySQL's utf8mb4_*_ci did: case and accents ignored, in
 *   =, unique keys and GROUP BY. Every string column gets the collation `ci`
 *   (ICU, nondeterministic). Postgres 17 refuses LIKE and regular expressions
 *   on such a column; those sites say COLLATE "C" or compare lower() values.
 * - tinyint(1) stays a number (smallint), so `= 0` and `= 1` mean what they did.
 * - An enum is text with a CHECK listing its values, and '' too: MySQL stores
 *   '' for a value its enum does not list, and library rows have it (27
 *   seeded substances whose category was not one of the five).
 * - ON UPDATE CURRENT_TIMESTAMP is a trigger that sets updated_at when the row
 *   changed and the update did not set updated_at itself, as MySQL does.
 * - Index names are per table in MySQL and per schema in Postgres: each index
 *   is named <table>__<name>.
 * - AUTO_INCREMENT is an identity column BY DEFAULT, so a copy can keep ids.
 */
import mysql from 'mysql2/promise';
import { STRING, enumValues, indexName, lit, pgDefault, pgType, q } from './types.mjs';

const db = process.argv[2];
if (!db) {
  console.error('usage: schema-from-mysql.mjs <mysql database>');
  process.exit(2);
}

const conn = await mysql.createConnection({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD || undefined,
  database: 'information_schema',
});
const rows = async (sql, params = []) => (await conn.query(sql, params))[0];

/** MySQL CHECK clause to Postgres. Only the shapes this schema has. */
function pgCheck(clause) {
  const m = /^regexp_like\(`(\w+)`,_utf8mb4\\'(.*)\\'\)$/.exec(clause);
  if (m) {
    const pattern = m[2].replace(/\\\\\\\\/g, '\\');
    return `(${q(m[1])} COLLATE "C" ~ ${lit(pattern)})`;
  }
  return clause.replace(/`(\w+)`/g, (_, id) => q(id));
}


const tables = await rows(
  `SELECT TABLE_NAME, TABLE_COMMENT FROM TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
  [db],
);
const columns = await rows(`SELECT * FROM COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION`, [db]);
const stats = await rows(
  `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME FROM STATISTICS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
  [db],
);
const fks = await rows(
  `SELECT k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, k.ORDINAL_POSITION, r.DELETE_RULE, r.UPDATE_RULE
     FROM KEY_COLUMN_USAGE k JOIN REFERENTIAL_CONSTRAINTS r
       ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
    WHERE k.TABLE_SCHEMA = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
  [db],
);
const checks = await rows(
  `SELECT tc.TABLE_NAME, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
     FROM CHECK_CONSTRAINTS cc JOIN TABLE_CONSTRAINTS tc
       ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
    WHERE cc.CONSTRAINT_SCHEMA = ? ORDER BY tc.TABLE_NAME, cc.CONSTRAINT_NAME`,
  [db],
);
await conn.end();

const out = [];
out.push(`-- db/pg/000-schema.sql: the LCAPIX schema on Postgres, equal to MySQL migration 042.
-- Written by scripts/db/pg/schema-from-mysql.mjs from a database fresh.mjs built,
-- then read and kept. Change the schema with a numbered file in db/pg/migrations,
-- never by editing this one.

-- Text compares as MySQL's *_ci collations did: case and accents ignored.
CREATE COLLATION IF NOT EXISTS ci (provider = icu, locale = 'und-u-ks-level1', deterministic = false);

-- MySQL's ON UPDATE CURRENT_TIMESTAMP: set updated_at when the row changed and
-- the update did not set updated_at itself.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at AND NEW::text IS DISTINCT FROM OLD::text THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
`);

const fkLines = [];
const triggerLines = [];
const commentLines = [];
for (const t of tables) {
  const name = t.TABLE_NAME;
  const cols = columns.filter((c) => c.TABLE_NAME === name);
  const lines = [];
  for (const c of cols) {
    let def = `  ${q(c.COLUMN_NAME)} ${pgType(c)}`;
    if (STRING.has(c.DATA_TYPE)) def += ' COLLATE ci';
    if (/auto_increment/i.test(c.EXTRA)) def += ' GENERATED BY DEFAULT AS IDENTITY';
    else {
      const d = pgDefault(c);
      if (d !== null) def += ` DEFAULT ${d}`;
    }
    if (c.IS_NULLABLE === 'NO') def += ' NOT NULL';
    if (c.DATA_TYPE === 'enum') {
      def += ` CHECK (${q(c.COLUMN_NAME)} IN (${['', ...enumValues(c.COLUMN_TYPE)].map(lit).join(', ')}))`;
    }
    lines.push(def);
    if (/on update CURRENT_TIMESTAMP/i.test(c.EXTRA)) {
      if (c.COLUMN_NAME !== 'updated_at') throw new Error(`ON UPDATE on ${name}.${c.COLUMN_NAME}: the trigger only sets updated_at`);
      triggerLines.push(`CREATE TRIGGER ${q(`${name}__set_updated_at`)} BEFORE UPDATE ON ${q(name)} FOR EACH ROW EXECUTE FUNCTION set_updated_at();`);
    }
    if (c.COLUMN_COMMENT) commentLines.push(`COMMENT ON COLUMN ${q(name)}.${q(c.COLUMN_NAME)} IS ${lit(c.COLUMN_COMMENT)};`);
  }
  const idx = stats.filter((s) => s.TABLE_NAME === name);
  const pk = idx.filter((s) => s.INDEX_NAME === 'PRIMARY').map((s) => q(s.COLUMN_NAME));
  if (pk.length) lines.push(`  CONSTRAINT ${q(`${name}_pkey`)} PRIMARY KEY (${pk.join(', ')})`);
  for (const ck of checks.filter((x) => x.TABLE_NAME === name)) {
    lines.push(`  CONSTRAINT ${q(ck.CONSTRAINT_NAME)} CHECK ${pgCheck(ck.CHECK_CLAUSE)}`);
  }
  out.push(`CREATE TABLE ${q(name)} (\n${lines.join(',\n')}\n);`);
  if (t.TABLE_COMMENT) commentLines.push(`COMMENT ON TABLE ${q(name)} IS ${lit(t.TABLE_COMMENT)};`);

  const byIndex = new Map();
  for (const s of idx.filter((s) => s.INDEX_NAME !== 'PRIMARY')) {
    if (!byIndex.has(s.INDEX_NAME)) byIndex.set(s.INDEX_NAME, { unique: Number(s.NON_UNIQUE) === 0, cols: [] });
    byIndex.get(s.INDEX_NAME).cols.push(q(s.COLUMN_NAME));
  }
  for (const [iname, i] of byIndex) {
    out.push(`CREATE ${i.unique ? 'UNIQUE ' : ''}INDEX ${q(indexName(name, iname))} ON ${q(name)} (${i.cols.join(', ')});`);
  }
  out.push('');

  const byFk = new Map();
  for (const f of fks.filter((f) => f.TABLE_NAME === name)) {
    if (!byFk.has(f.CONSTRAINT_NAME)) byFk.set(f.CONSTRAINT_NAME, { ...f, cols: [], refs: [] });
    byFk.get(f.CONSTRAINT_NAME).cols.push(q(f.COLUMN_NAME));
    byFk.get(f.CONSTRAINT_NAME).refs.push(q(f.REFERENCED_COLUMN_NAME));
  }
  for (const [fname, f] of byFk) {
    const del = f.DELETE_RULE === 'NO ACTION' ? 'RESTRICT' : f.DELETE_RULE;
    fkLines.push(
      `ALTER TABLE ${q(name)} ADD CONSTRAINT ${q(fname)} FOREIGN KEY (${f.cols.join(', ')}) REFERENCES ${q(f.REFERENCED_TABLE_NAME)} (${f.refs.join(', ')}) ON DELETE ${del};`,
    );
  }
}

out.push('-- Foreign keys, once every table exists.');
out.push(...fkLines, '');
out.push('-- MySQL ON UPDATE CURRENT_TIMESTAMP columns.');
out.push(...triggerLines, '');
out.push(...commentLines, '');
process.stdout.write(out.join('\n'));
