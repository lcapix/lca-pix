/**
 * lib/field-limits.ts encodes the size of every text and fixed-point column
 * the API validates against. Checked here against the fresh Postgres
 * database, so a migration that resizes a column cannot leave the API
 * validating against a stale number. A TEXT limit (65,535 bytes, MySQL's)
 * is the API's own rule now: Postgres text holds more, so the column only
 * has to be text.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COLUMN_LIMITS } from '@/lib/field-limits';
import { connect, rows } from './support/db';

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
          `SELECT data_type AS type, character_maximum_length AS chars, numeric_precision AS p, numeric_scale AS s
             FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ? AND column_name = ?`,
          [table, column],
        );
        expect(c, `${table}.${column} exists`).toBeDefined();
        if (limit.kind === 'chars') {
          expect(c.type).toBe('character varying');
          expect(Number(c.chars)).toBe(limit.max);
        } else if (limit.kind === 'bytes') {
          expect(c.type).toBe('text');
        } else {
          expect(c.type).toBe('numeric');
          expect([Number(c.p), Number(c.s)]).toEqual([limit.precision, limit.scale]);
        }
      });
    }
  }
});
