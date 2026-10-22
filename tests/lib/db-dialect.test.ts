/**
 * The MySQL the app is written in, as Postgres runs it (the port, P1):
 * placeholders, identifiers, insertId, booleans, and the MySQL error codes
 * the routes check.
 */
import { describe, expect, it } from 'vitest';
import { asMysqlError, toPgParams, toPgSql } from '@/lib/db-dialect';

describe('toPgSql', () => {
  it('numbers each ? placeholder in order', () => {
    expect(toPgSql('SELECT * FROM flows WHERE component_id = ? AND quantity > ?').text).toBe(
      'SELECT * FROM flows WHERE component_id = $1 AND quantity > $2',
    );
  });

  it('leaves a ? alone inside a string, a quoted identifier or a comment', () => {
    const sql = `SELECT 'is it?', 'it''s ?', "odd?col" FROM t -- why?\nWHERE a = ? /* or ? */ AND b = ?`;
    expect(toPgSql(sql).text).toBe(`SELECT 'is it?', 'it''s ?', "odd?col" FROM t -- why?\nWHERE a = $1 /* or ? */ AND b = $2`);
  });

  it("says AS text for MySQL's CAST(x AS CHAR), outside strings only", () => {
    expect(toPgSql(`SELECT CAST(factor_value AS CHAR) AS v, CAST(x AS char ) y, 'CAST(a AS CHAR)' FROM t`).text).toBe(
      `SELECT CAST(factor_value AS text) AS v, CAST(x AS text) y, 'CAST(a AS CHAR)' FROM t`,
    );
    expect(toPgSql('SELECT x AS CHARGE FROM t').text).toBe('SELECT x AS CHARGE FROM t');
  });

  it('turns a backtick identifier into a quoted one', () => {
    expect(toPgSql('SELECT `timestamp` FROM audit_log WHERE `user_id` = ?').text).toBe(
      'SELECT "timestamp" FROM audit_log WHERE "user_id" = $1',
    );
  });

  it('adds RETURNING for the identity column, so the result can carry insertId', () => {
    expect(toPgSql('INSERT INTO flows (component_id, unit) VALUES (?, ?)')).toEqual({
      text: 'INSERT INTO flows (component_id, unit) VALUES ($1, $2) RETURNING "flow_id"',
      returning: 'flow_id',
    });
    expect(toPgSql('  insert into account (email) values (?);').text).toBe('  insert into account (email) values ($1) RETURNING "id"');
    expect(toPgSql('INSERT INTO cost_rates (rate_key) VALUES (?) ON CONFLICT (rate_key) DO UPDATE SET rate_key = EXCLUDED.rate_key').text).toMatch(
      / DO UPDATE SET rate_key = EXCLUDED\.rate_key RETURNING "rate_id"$/,
    );
  });

  it('adds nothing for a table without one, a statement with its own RETURNING, or a read', () => {
    expect(toPgSql('INSERT INTO project_pins (user_id, project_id) VALUES (?, ?) ON CONFLICT DO NOTHING').returning).toBeNull();
    expect(toPgSql('INSERT INTO flows (unit) VALUES (?) RETURNING flow_id').text).toBe('INSERT INTO flows (unit) VALUES ($1) RETURNING flow_id');
    expect(toPgSql('SELECT ? AS x').returning).toBeNull();
  });
});

describe('toPgParams', () => {
  it('sends booleans as 1/0 (the tinyint columns) and undefined as NULL', () => {
    const d = new Date(0);
    expect(toPgParams([true, false, undefined, null, 0, 'a', d])).toEqual([1, 0, null, null, 0, 'a', d]);
    expect(toPgParams()).toEqual([]);
  });

  it("sends parseId's NaN (and infinities) as NULL: no row matches, as on MySQL", () => {
    expect(toPgParams([NaN, Infinity, -Infinity, 1.5])).toEqual([null, null, null, 1.5]);
  });
});

describe('asMysqlError', () => {
  const pgError = (code: string, message: string, extra: object = {}) => Object.assign(new Error(message), { code, severity: 'ERROR', ...extra });

  it('gives a unique violation the MySQL duplicate-key code and keeps the constraint', () => {
    const e: any = asMysqlError(pgError('23505', 'duplicate key value violates unique constraint "account__email"', { constraint: 'account__email' }));
    expect(e).toMatchObject({ code: 'ER_DUP_ENTRY', errno: 1062, sqlState: '23505', constraint: 'account__email' });
    expect(e.sqlMessage).toBe(e.message);
  });

  it('tells a missing parent from a row still referenced', () => {
    expect(asMysqlError(pgError('23503', 'insert or update on table "flows" violates foreign key constraint')) as any).toMatchObject({ code: 'ER_NO_REFERENCED_ROW_2', errno: 1452 });
    expect(asMysqlError(pgError('23503', 'Key (id)=(1) is still referenced from table "project".')) as any).toMatchObject({ code: 'ER_ROW_IS_REFERENCED_2', errno: 1451 });
  });

  it('maps the codes the routes check', () => {
    const codes: Array<[string, string, number]> = [
      ['42P01', 'ER_NO_SUCH_TABLE', 1146],
      ['42703', 'ER_BAD_FIELD_ERROR', 1054],
      ['23502', 'ER_BAD_NULL_ERROR', 1048],
      ['22003', 'ER_WARN_DATA_OUT_OF_RANGE', 1264],
      ['22001', 'ER_DATA_TOO_LONG', 1406],
    ];
    for (const [state, code, errno] of codes) expect(asMysqlError(pgError(state, 'x')) as any).toMatchObject({ code, errno, sqlState: state });
  });

  it('keeps an unmapped SQLSTATE, and leaves non-database errors alone', () => {
    expect(asMysqlError(pgError('42P18', 'could not determine data type of parameter $1')) as any).toMatchObject({ code: '42P18', sqlState: '42P18' });
    const net = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
    expect(asMysqlError(net)).toBe(net);
    expect((net as any).sqlState).toBeUndefined();
    expect(asMysqlError(null)).toBeNull();
  });
});
