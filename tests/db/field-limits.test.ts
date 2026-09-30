/**
 * lib/field-limits.ts encodes the size of every text and fixed-point column
 * the API validates against. Checked here against the fully migrated fresh
 * database, so a migration that resizes a column cannot leave the API
 * validating against a stale number.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COLUMN_LIMITS } from '@/lib/field-limits';
import { connect, rows, testDb } from './support/db';

let conn: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => {
  conn = await connect();
});
afterAll(async () => {
  await conn?.end();
});

describe('lib/field-limits.ts matches information_schema', () => {
  for (const [table, columns] of Object.entries(COLUMN_LIMITS)) {
    for (const [column, limit] of Object.entries(columns)) {
      it(`${table}.${column}`, async () => {
        const [c] = await rows<any>(
          conn,
          `SELECT LOWER(DATA_TYPE) AS type, CHARACTER_MAXIMUM_LENGTH AS chars, CHARACTER_OCTET_LENGTH AS bytes,
                  NUMERIC_PRECISION AS p, NUMERIC_SCALE AS s
             FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [testDb().database, table, column],
        );
        expect(c, `${table}.${column} exists`).toBeDefined();
        if (limit.kind === 'chars') {
          expect(c.type).toBe('varchar');
          expect(Number(c.chars)).toBe(limit.max);
        } else if (limit.kind === 'bytes') {
          expect(c.type).toBe('text');
          expect(Number(c.bytes)).toBe(limit.max);
        } else {
          expect(c.type).toBe('decimal');
          expect([Number(c.p), Number(c.s)]).toEqual([limit.precision, limit.scale]);
        }
      });
    }
  }
});
