/**
 * The migration chain, applied the way production applies it
 * (scripts/db/migrate.mjs, which records every file in schema_migrations).
 *
 * This file builds its own database from the baseline alone (fresh.mjs
 * --no-migrate) so the first apply is observed here, not in the global setup.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listMigrations } from '../../scripts/db/migrate.mjs';
import {
  ROOT,
  connect,
  createDb,
  dropDb,
  mysqlCli,
  referenceSnapshot,
  rows,
  runMigrate,
  schemaSnapshot,
} from './support/db';

const MIGRATIONS = listMigrations(ROOT);

let dbName: string;
let conn: Awaited<ReturnType<typeof connect>>;
let firstRun: ReturnType<typeof runMigrate>;

async function ledger() {
  return rows<{ filename: string; checksum: string; applied_at: string; baseline: number }>(
    conn,
    'SELECT filename, checksum, CAST(applied_at AS CHAR) AS applied_at, baseline FROM schema_migrations ORDER BY filename',
  );
}

describe('migration chain on an empty database', () => {
  beforeAll(() => {
    dbName = createDb(['--no-migrate']);
  });
  afterAll(async () => {
    await conn?.end();
    if (dbName) dropDb(dbName);
  });

  it('finds the numbered migrations in the repo root, in order, with no duplicate numbers', () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(21);
    expect(MIGRATIONS[0].filename).toBe('migrate-009-factor-basis-audit.sql');
    const numbers = MIGRATIONS.map((m) => m.number);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('applies every migration cleanly, in numeric order', async () => {
    firstRun = runMigrate(dbName);
    expect(firstRun.stderr).not.toMatch(/FAILED|ERROR/);
    expect(firstRun.status).toBe(0);
    const applied = firstRun.stdout
      .split('\n')
      .filter((l) => l.startsWith('applying'))
      .map((l) => l.replace(/^applying\s+/, '').trim());
    expect(applied).toEqual(MIGRATIONS.map((m) => m.filename));
    expect(firstRun.stdout).toContain(`Applied ${MIGRATIONS.length} migration(s)`);
    conn = await connect(dbName);
  });

  it('records every migration file in schema_migrations with its sha256 checksum', async () => {
    const recorded = await ledger();
    expect(recorded.map((r) => r.filename)).toEqual(MIGRATIONS.map((m) => m.filename).sort());
    const byName = new Map(recorded.map((r) => [r.filename, r]));
    for (const m of MIGRATIONS) {
      const row = byName.get(m.filename)!;
      expect(row.checksum, m.filename).toBe(m.checksum);
      expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(row.baseline, `${m.filename} was run, not baselined`).toBe(0);
    }
  });

  it('a second run is a no-op: nothing applied, schema, ledger and reference data unchanged', async () => {
    const schemaBefore = await schemaSnapshot(conn, dbName);
    const refBefore = await referenceSnapshot(conn);
    const ledgerBefore = await ledger();

    const second = runMigrate(dbName);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain(`Nothing to apply`);
    expect(second.stdout).toContain(`all ${MIGRATIONS.length} migration(s) recorded`);
    expect(second.stdout).not.toMatch(/^applying/m);
    expect(second.out).not.toMatch(/WARNING/);

    expect(await schemaSnapshot(conn, dbName)).toEqual(schemaBefore);
    expect(await ledger()).toEqual(ledgerBefore);
    const refAfter = await referenceSnapshot(conn);
    expect(refAfter.substances).toEqual(refBefore.substances);
    expect(refAfter.templates).toEqual(refBefore.templates);
    expect(refAfter.vintage).toEqual(refBefore.vintage);
    expect([...refAfter.factors.entries()]).toEqual([...refBefore.factors.entries()]);

    const dry = runMigrate(dbName, ['--dry-run']);
    expect(dry.status).toBe(0);
    expect(dry.stdout).not.toMatch(/^pending/m);
  });

  it('detects an applied migration whose file changed, and does not re-run it', async () => {
    // A private copy of the migrations with one applied file edited. The repo
    // files are never touched.
    const dir = mkdtempSync(path.join(tmpdir(), 'lcapix-migrations-'));
    try {
      for (const m of MIGRATIONS) copyFileSync(m.path, path.join(dir, m.filename));
      const target = MIGRATIONS.find((m) => m.filename.startsWith('migrate-026-'))!;
      appendFileSync(path.join(dir, target.filename), '\n-- edited after it was applied\nSELECT 1;\n');
      const ledgerBefore = await ledger();

      const r = runMigrate(dbName, [`--dir=${dir}`]);
      expect(r.status).toBe(0);
      expect(r.stderr).toContain(`WARNING: ${target.filename} changed since it was recorded`);
      expect(r.stderr).toContain('It is NOT re-run');
      // Exactly one file is reported.
      expect(r.stderr.match(/WARNING: /g)?.length).toBe(1);
      expect(r.stdout).not.toMatch(/^applying/m);
      expect(await ledger()).toEqual(ledgerBefore);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('picks up a new numbered migration automatically and records it', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'lcapix-migrations-'));
    try {
      for (const m of MIGRATIONS) copyFileSync(m.path, path.join(dir, m.filename));
      const name = 'migrate-999-db-test-probe.sql';
      expect(MIGRATIONS.some((m) => m.number === 999)).toBe(false);
      writeFileSync(path.join(dir, name), 'CREATE TABLE IF NOT EXISTS db_test_probe (id INT PRIMARY KEY);\n');
      const r = runMigrate(dbName, [`--dir=${dir}`]);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(`applying  ${name}`);
      expect(r.stdout).toContain('Applied 1 migration(s)');
      const [row] = await rows(conn, 'SELECT checksum FROM schema_migrations WHERE filename = ?', [name]);
      expect(row?.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(readdirSync(dir)).toContain(name);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('every migration can be applied a second time by hand without an error or a schema change', async () => {
    // What happens if someone pipes the files into mysql again, bypassing the
    // ledger. Each file must be guarded (audit §5). Factor VALUES must not
    // move either. Known text-only change: migrate-009 section 2e rewrites the
    // provenance of the five rows it zeroes, dropping the "QUARANTINED
    // 2026-09-15" prefix migrate-017 wrote (the E5 family: 009 is not safe to
    // re-run on its own, which is why the ledger exists).
    await conn.query('DROP TABLE IF EXISTS db_test_probe');
    await conn.query("DELETE FROM schema_migrations WHERE filename LIKE '%db-test-probe%'");
    const schemaBefore = await schemaSnapshot(conn, dbName);
    const refBefore = await referenceSnapshot(conn);

    for (const m of MIGRATIONS) {
      const r = mysqlCli(dbName, readFileSync(m.path, 'utf8'));
      expect(r.stderr.replace(/^mysql: \[Warning\].*$/gm, '').trim(), `${m.filename} on a second raw apply`).toBe('');
      expect(r.status, m.filename).toBe(0);
    }

    expect(await schemaSnapshot(conn, dbName)).toEqual(schemaBefore);
    const refAfter = await referenceSnapshot(conn);
    expect(refAfter.substances).toEqual(refBefore.substances);
    expect(refAfter.templates).toEqual(refBefore.templates);
    expect([...refAfter.factors.keys()].sort()).toEqual([...refBefore.factors.keys()].sort());

    const valueChanges: string[] = [];
    const textChanges: string[] = [];
    for (const [key, before] of refBefore.factors) {
      const after = refAfter.factors.get(key);
      if (!after) continue;
      if (after.factor_value !== before.factor_value || after.unit !== before.unit || after.factor_basis !== before.factor_basis) {
        valueChanges.push(`${key}: ${before.factor_value} ${before.unit} -> ${after.factor_value} ${after.unit}`);
      }
      if (after.source_reference !== before.source_reference) textChanges.push(key);
    }
    expect(valueChanges).toEqual([]);
    expect(textChanges.sort()).toEqual(
      [
        'Natural Gas | Photochemical Oxidation | QUARANTINE: CML 2001 | Global',
        'Solid Waste | Ozone Depletion | QUARANTINE: CML 2001 | Global',
        'Wastewater | Acidification | QUARANTINE: CML 2001 | Global',
        'Wastewater | Ozone Depletion | QUARANTINE: CML 2001 | Global',
        'Water | Photochemical Oxidation | QUARANTINE: CML 2001 | Global',
      ].sort(),
    );
  });
});
