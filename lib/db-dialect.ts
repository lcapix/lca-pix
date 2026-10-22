/**
 * The SQL the app was written in (MySQL) as Postgres runs it, and Postgres's
 * answers in the shapes the app reads (the port to Postgres, P1). Pure, so
 * every rule is tested without a database; lib/db.ts applies them.
 *
 * - `?` placeholders become $1, $2, ... (never inside a quoted string, an
 *   identifier or a comment); a backtick identifier becomes a quoted one;
 *   MySQL's CAST(x AS CHAR), "as text", says AS text (Postgres's CHAR is one
 *   character and would cut the value short).
 * - An INSERT into a table with an identity column gets RETURNING that
 *   column, so the result can carry MySQL's insertId.
 * - A JS boolean parameter is sent as 1 or 0: the schema keeps MySQL's
 *   tinyint(1) columns as numbers (db/pg/000-schema.sql). A NaN or infinite
 *   number is sent as NULL: lib/ids.ts parseId answers NaN for an id that is
 *   not one, and MySQL matched no row with it (so the route said 404), where
 *   Postgres refuses it outright.
 * - A Postgres error gets the MySQL code and errno the routes check
 *   ('ER_DUP_ENTRY', 1062, ...); the SQLSTATE stays in sqlState and the
 *   violated constraint in constraint.
 */

/** Identity column of each table (db/pg/000-schema.sql): what MySQL's insertId reported. */
export const IDENTITY: Readonly<Record<string, string>> = {
  account: 'id',
  assessment_results: 'result_id',
  assessment_runs: 'run_id',
  audit_log: 'log_id',
  case_documents: 'document_id',
  case_table: 'case_id',
  comparison_metadata: 'metadata_id',
  comparison_results: 'result_id',
  comparison_runs: 'comparison_id',
  component: 'component_id',
  cost_rates: 'rate_id',
  driver_impact_factors: 'factor_id',
  flow_factor_overrides: 'override_id',
  flows: 'flow_id',
  impact_categories: 'category_id',
  import_held_lines: 'held_id',
  integration_log: 'log_id',
  permissions: 'permission_id',
  process_template_flows: 'template_flow_id',
  process_templates: 'template_id',
  project: 'project_id',
  project_members: 'member_id',
  substances: 'substance_id',
};

export interface PgStatement {
  text: string;
  /** The identity column RETURNING was added for, or null. */
  returning: string | null;
}

/** MySQL-flavoured SQL as Postgres text: placeholders, identifiers, insertId. */
export function toPgSql(sql: string): PgStatement {
  let out = '';
  let n = 0;
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'") {
      // A string literal; '' is a quote inside it.
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1;
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '"') {
      const j = sql.indexOf('"', i + 1);
      const end = j === -1 ? sql.length : j + 1;
      out += sql.slice(i, end);
      i = end;
    } else if (ch === '`') {
      const j = sql.indexOf('`', i + 1);
      const end = j === -1 ? sql.length : j;
      out += `"${sql.slice(i + 1, end)}"`;
      i = end + 1;
    } else if (ch === '-' && next === '-') {
      const j = sql.indexOf('\n', i);
      const end = j === -1 ? sql.length : j;
      out += sql.slice(i, end);
      i = end;
    } else if (ch === '/' && next === '*') {
      const j = sql.indexOf('*/', i + 2);
      const end = j === -1 ? sql.length : j + 2;
      out += sql.slice(i, end);
      i = end;
    } else if (ch === '?') {
      out += `$${++n}`;
      i += 1;
    } else if (/^AS\s+CHAR\s*\)/i.test(sql.slice(i, i + 12)) && /[\s(]/.test(sql[i - 1] ?? ' ')) {
      const m = /^AS\s+CHAR\s*\)/i.exec(sql.slice(i))!;
      out += 'AS text)';
      i += m[0].length;
    } else {
      out += ch;
      i += 1;
    }
  }

  const insert = /^\s*INSERT\s+INTO\s+"?(\w+)"?/i.exec(out);
  const returning = insert && !/\bRETURNING\b/i.test(out) ? (IDENTITY[insert[1]] ?? null) : null;
  if (returning) out = `${out.replace(/;\s*$/, '')} RETURNING "${returning}"`;
  return { text: out, returning };
}

/** Parameters as Postgres takes them: booleans as 1/0 (tinyint columns); undefined, NaN and infinities as NULL. */
export function toPgParams(params: readonly unknown[] = []): unknown[] {
  return params.map((p) =>
    p === true ? 1 : p === false ? 0 : p === undefined || (typeof p === 'number' && !Number.isFinite(p)) ? null : p,
  );
}

/** SQLSTATE to the MySQL error the routes check. */
const MYSQL_ERROR: Readonly<Record<string, readonly [string, number]>> = {
  '23505': ['ER_DUP_ENTRY', 1062],
  '23502': ['ER_BAD_NULL_ERROR', 1048],
  '23514': ['ER_CHECK_CONSTRAINT_VIOLATED', 3819],
  '22001': ['ER_DATA_TOO_LONG', 1406],
  '22003': ['ER_WARN_DATA_OUT_OF_RANGE', 1264],
  '22P02': ['ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 1366],
  '22007': ['ER_TRUNCATED_WRONG_VALUE', 1292],
  '22008': ['ER_TRUNCATED_WRONG_VALUE', 1292],
  '42P01': ['ER_NO_SUCH_TABLE', 1146],
  '42703': ['ER_BAD_FIELD_ERROR', 1054],
  '42601': ['ER_PARSE_ERROR', 1064],
  '40P01': ['ER_LOCK_DEADLOCK', 1213],
  '55P03': ['ER_LOCK_WAIT_TIMEOUT', 1205],
  '53300': ['ER_CON_COUNT_ERROR', 1040],
};

/**
 * Gives a Postgres error the MySQL code and errno the app checks. Returns the
 * same object. Anything that is not a database error is left alone.
 */
export function asMysqlError<E>(err: E): E {
  const e = err as (Error & { code?: unknown; errno?: unknown; severity?: unknown; sqlState?: string; sqlMessage?: string }) | null;
  // A server error from pg carries a severity; a network one (EPIPE) does not.
  if (!e || typeof e.severity !== 'string' || typeof e.code !== 'string' || !/^[0-9A-Z]{5}$/.test(e.code)) return err;
  const sqlState = e.code;
  const mapped =
    sqlState === '23503'
      ? /still referenced/.test(e.message)
        ? (['ER_ROW_IS_REFERENCED_2', 1451] as const)
        : (['ER_NO_REFERENCED_ROW_2', 1452] as const)
      : MYSQL_ERROR[sqlState];
  e.sqlState = sqlState;
  e.sqlMessage = e.message;
  if (mapped) {
    e.code = mapped[0];
    e.errno = mapped[1];
  }
  return err;
}
