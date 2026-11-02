/**
 * G2: migrate-045 adds the write-up's Limits column to case_table: nullable,
 * text, and a second run changes nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MIGRATIONS_DIR } from '../../scripts/db/migrate.mjs';
import { connect, createDb, dropDb, rows, sqlFile } from './support/db';

const FILE = path.join(MIGRATIONS_DIR, 'migrate-045-writeup-limits.sql');

let dbName: string;
let conn: Awaited<ReturnType<typeof connect>>;

const column = async () =>
  rows<{ data_type: string; is_nullable: string }>(
    conn,
    `SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'case_table' AND column_name = 'limitations'`,
  );

describe('migrate-045 on a database without it', () => {
  beforeAll(async () => {
    dbName = createDb(['--no-migrate']);
    conn = await connect(dbName);
  });
  afterAll(async () => {
    await conn?.end();
    if (dbName) dropDb(dbName);
  });

  it('adds case_table.limitations as nullable text, and a second run changes nothing', async () => {
    expect(await column()).toEqual([]);
    const sql = readFileSync(FILE, 'utf8');
    expect((await sqlFile(dbName, sql)).error).toBe('');
    expect(await column()).toEqual([{ data_type: 'text', is_nullable: 'YES' }]);
    expect((await sqlFile(dbName, sql)).error).toBe('');
    expect(await column()).toEqual([{ data_type: 'text', is_nullable: 'YES' }]);
  });
});
