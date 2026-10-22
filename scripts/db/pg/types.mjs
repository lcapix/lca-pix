/**
 * How a MySQL column of this schema maps to Postgres (the port, P0). One set
 * of rules for the generator (schema-from-mysql.mjs) and the comparison
 * (compare-schema.mjs), so the two cannot drift apart.
 */

export const q = (id) => `"${id}"`;
export const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
/** MySQL string types: each gets the collation ci in Postgres. */
export const STRING = new Set(['varchar', 'char', 'text', 'mediumtext', 'longtext', 'tinytext', 'enum']);
const NUMERIC = ['int', 'tinyint', 'smallint', 'bigint', 'decimal', 'double', 'float'];

/** The Postgres type for a MySQL column (without collation or default), as format_type() prints it. */
export function pgType(c) {
  const t = c.DATA_TYPE;
  const ct = c.COLUMN_TYPE;
  if (t === 'int') return 'integer';
  if (t === 'bigint') return 'bigint';
  if (t === 'smallint' || t === 'tinyint') return 'smallint';
  if (t === 'decimal') return `numeric(${c.NUMERIC_PRECISION},${c.NUMERIC_SCALE})`;
  if (t === 'double') return 'double precision';
  if (t === 'float') return 'real';
  if (t === 'timestamp' || t === 'datetime') return 'timestamp with time zone';
  if (t === 'date') return 'date';
  if (t === 'json') return 'jsonb';
  if (t === 'varchar') return `character varying(${c.CHARACTER_MAXIMUM_LENGTH})`;
  if (t === 'char') return `character(${c.CHARACTER_MAXIMUM_LENGTH})`;
  if (t === 'text' || t === 'mediumtext' || t === 'longtext' || t === 'tinytext') return 'text';
  if (t === 'enum') return `character varying(${Math.max(...enumValues(ct).map((v) => v.length))})`;
  throw new Error(`No Postgres type for ${c.TABLE_NAME}.${c.COLUMN_NAME} (${ct})`);
}

/** The values of a MySQL enum column type. */
export function enumValues(columnType) {
  return [...columnType.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
}

/** The Postgres DEFAULT for a MySQL column, or null for none. */
export function pgDefault(c) {
  const d = c.COLUMN_DEFAULT;
  if (d === null || d === undefined) return null;
  if (/^CURRENT_TIMESTAMP/i.test(d)) return 'now()';
  if (NUMERIC.includes(c.DATA_TYPE)) return String(Number(d));
  return lit(d);
}

/** Postgres index name for a MySQL index: names are per table there, per schema here. */
export const indexName = (table, name) => `${table}__${name}`.slice(0, 63);
