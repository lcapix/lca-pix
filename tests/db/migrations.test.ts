/**
 * The Postgres baseline and migration runner, applied the way production is
 * (scripts/db/fresh.mjs builds the baseline; scripts/db/migrate.mjs applies the
 * numbered files in db/pg/migrations and records each in schema_migrations).
 *
 * The MySQL chain (migrate-009 to 042 at the repo root) is history: its result
 * is db/pg/000-schema.sql and 001-reference.sql, checked by schema.test.ts and
 * scripts/db/pg/compare-schema.mjs. Its own tests (each file twice by hand,
 * migrate-032's backfill) ran on MySQL and are not repeated here.
 *
 * Runner tests use a private directory of probe migrations, never the repo's.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, appendFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { baselineEntries, listMigrations, MIGRATIONS_DIR } from '../../scripts/db/migrate.mjs';
import { connect, createDb, dropDb, referenceSnapshot, rows, runMigrate, schemaSnapshot } from './support/db';

let dbName: string;
let conn: Awaited<ReturnType<typeof connect>>;
let dir: string;

async function ledger() {
  return rows<{ filename: string; checksum: string; applied_at: string; baseline: number }>(
    conn,
    'SELECT filename, checksum, CAST(applied_at AS CHAR) AS applied_at, baseline FROM schema_migrations ORDER BY filename',
  );
}

describe('the baseline and the runner on a fresh database', () => {
  beforeAll(async () => {
    dbName = createDb(['--no-migrate']);
    conn = await connect(dbName);
    dir = mkdtempSync(path.join(tmpdir(), 'lcapix-pg-migrations-'));
  });
  afterAll(async () => {
    await conn?.end();
    if (dbName) dropDb(dbName);
    rmSync(dir, { recursive: true, force: true });
  });

  it('records the baseline files with their checksums', async () => {
    const want = baselineEntries().map((b) => ({ filename: b.filename, checksum: b.checksum, baseline: 1 }));
    expect((await ledger()).map(({ filename, checksum, baseline }) => ({ filename, checksum, baseline }))).toEqual(want);
  });

  it("the repo's own migrations are numbered, in order, with no duplicate numbers, and the first is past 042", () => {
    const files = listMigrations(MIGRATIONS_DIR);
    for (const f of files) expect(f.number, f.filename).toBeGreaterThan(42);
  });

  it('applies a new numbered migration and records it; a second run applies nothing and changes nothing', async () => {
    const name = 'migrate-998-db-test-probe.sql';
    writeFileSync(path.join(dir, name), 'CREATE TABLE IF NOT EXISTS db_test_probe (id integer PRIMARY KEY);\n');
    const first = runMigrate(dbName, [`--dir=${dir}`]);
    expect(first.status, first.out).toBe(0);
    expect(first.stdout).toContain(`applying  ${name}`);
    expect(first.stdout).toContain('Applied 1 migration(s)');
    const [row] = await rows(conn, 'SELECT checksum, baseline FROM schema_migrations WHERE filename = ?', [name]);
    expect(row).toMatchObject({ checksum: expect.stringMatching(/^[0-9a-f]{64}$/), baseline: 0 });

    const schemaBefore = await schemaSnapshot(conn);
    const refBefore = await referenceSnapshot(conn);
    const ledgerBefore = await ledger();
    const second = runMigrate(dbName, [`--dir=${dir}`]);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('Nothing to apply');
    expect(await schemaSnapshot(conn)).toEqual(schemaBefore);
    expect(await referenceSnapshot(conn)).toEqual(refBefore);
    expect(await ledger()).toEqual(ledgerBefore);
  });

  it('detects an applied migration whose file changed, and does not re-run it', async () => {
    const name = 'migrate-998-db-test-probe.sql';
    appendFileSync(path.join(dir, name), '\n-- edited after it was applied\nSELECT 1;\n');
    const before = await ledger();
    const r = runMigrate(dbName, [`--dir=${dir}`]);
    expect(r.status).toBe(0);
    expect(r.stderr).toContain(`WARNING: ${name} changed since it was recorded`);
    expect(r.stderr).toContain('It is NOT re-run');
    expect(r.stderr.match(/WARNING: /g)?.length).toBe(1);
    expect(r.stdout).not.toMatch(/^applying/m);
    expect(await ledger()).toEqual(before);
  });

  it('a migration that fails changes nothing and is not recorded, and the run stops there', async () => {
    const bad = 'migrate-999-db-test-fails.sql';
    // The first statement would succeed on its own; the second fails, so the
    // transaction takes the first back with it.
    writeFileSync(path.join(dir, bad), 'CREATE TABLE db_test_half (id integer);\nSELECT no_such_column FROM account;\n');
    const before = await ledger();
    const r = runMigrate(dbName, [`--dir=${dir}`]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`FAILED    ${bad}`);
    expect(await ledger()).toEqual(before);
    expect(await rows(conn, `SELECT to_regclass('public.db_test_half') AS t`)).toEqual([{ t: null }]);
  });

  it('refuses a database that was not built from this baseline', async () => {
    await conn.query(`DELETE FROM schema_migrations WHERE filename = '000-schema.sql'`);
    try {
      const r = runMigrate(dbName, [`--dir=${dir}`]);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('does not record 000-schema.sql');
    } finally {
      const [b] = baselineEntries();
      await conn.query(`INSERT INTO schema_migrations (filename, checksum, baseline) VALUES (?, ?, 1)`, [b.filename, b.checksum]);
    }
  });
});
