/**
 * migrate-028 (Wood fuel / lumber split + unit guard) and migrate-029 (GWP
 * vintage) against the LOCAL dev database.
 *
 * Run with:  set -a; source .env.local; set +a; LOCAL_DB=1 npx vitest run tests/e2e-local
 * Skipped unless LOCAL_DB=1, and refuses any host but 127.0.0.1/localhost.
 * Requires 028 and 029 applied (node --env-file=.env.local scripts/db/migrate.mjs).
 *
 * The guard checks run the file's GUARD section inside a transaction that
 * always ends in ROLLBACK, so a deliberately broken row never persists, even
 * if the guard failed to fire.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const enabled = process.env.LOCAL_DB === '1';
const host = process.env.DATABASE_HOST || '127.0.0.1';
const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(host.trim().toLowerCase());
const d = describe.skipIf(!enabled);

const FILE = path.resolve(__dirname, '../../migrate-028-wood-fuel-lumber-split.sql');
const SQL = readFileSync(FILE, 'utf8');
const GUARD = SQL.slice(SQL.indexOf('-- GUARD BEGIN'), SQL.indexOf('-- GUARD END'));

function mysqlCli(input: string) {
  const env = { ...process.env } as Record<string, string | undefined>;
  if (process.env.DATABASE_PASSWORD) env.MYSQL_PWD = process.env.DATABASE_PASSWORD;
  return spawnSync(
    'mysql',
    [
      `--host=${host}`,
      `--port=${process.env.DATABASE_PORT || '3306'}`,
      `--user=${process.env.DATABASE_USER || 'root'}`,
      '--default-character-set=utf8mb4',
      process.env.DATABASE_NAME || 'lcapix_factors',
    ],
    { input, encoding: 'utf8', env: env as NodeJS.ProcessEnv },
  );
}

let conn: mysql.Connection;

async function woodRows() {
  const [rows]: any = await conn.query(
    `SELECT s.substance_name, s.unit AS substance_unit, d.method_name, d.factor_value, d.unit, d.factor_basis,
            d.source_reference, d.updated_at
       FROM driver_impact_factors d
       JOIN substances s ON s.substance_id = d.substance_id
       JOIN impact_categories ic ON ic.category_id = d.category_id
      WHERE s.substance_name IN ('Wood', 'Wood, dimensional lumber') AND ic.category_name = 'Global Warming'
      ORDER BY s.substance_name, d.method_name`,
  );
  return rows as any[];
}

d('migrate-028 / migrate-029 (local DB)', () => {
  beforeAll(async () => {
    if (!isLocal) throw new Error(`refusing to run migration tests against non-local host ${host}`);
    conn = await mysql.createConnection({
      host,
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'lcapix_factors',
      port: +(process.env.DATABASE_PORT || 3306),
    });
  });
  afterAll(async () => {
    await conn?.end();
  });

  it('Wood is the MMBtu fuel at 94.956 and the lumber is kg at 0.187, under all three methods', async () => {
    const rows = await woodRows();
    const fuel = rows.filter((r) => r.substance_name === 'Wood');
    const lumber = rows.filter((r) => r.substance_name === 'Wood, dimensional lumber');
    expect(fuel.map((r) => r.method_name)).toEqual(['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1']);
    for (const r of fuel) {
      expect(r.substance_unit).toBe('MMBtu');
      expect(parseFloat(r.factor_value)).toBe(94.956);
      expect(r.unit).toBe('kg CO2 eq / MMBtu');
      expect(r.factor_basis).toBe('embodied');
      expect(r.source_reference).toContain('93.8 + 0.2016 + 0.954 = 94.956');
    }
    expect(lumber).toHaveLength(3);
    for (const r of lumber) {
      expect(r.substance_unit).toBe('kg');
      expect(parseFloat(r.factor_value)).toBe(0.187);
      expect(r.unit).toBe('kg CO2 eq / kg');
      expect(r.source_reference).toContain('0.17 x 1000 / 907.18474');
    }
  });

  it('re-applying migrate-028 changes nothing (idempotent, row timestamps included)', async () => {
    const before = await woodRows();
    const r = mysqlCli(SQL);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('migrate-028 guard passed');
    expect(await woodRows()).toEqual(before);
  });

  it('the guard fails loudly on the E1 clobber (0.187 on the MMBtu fuel), and nothing persists', async () => {
    const r = mysqlCli(`START TRANSACTION;
UPDATE driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
   SET d.factor_value = 0.187
 WHERE s.substance_name = 'Wood' AND d.category_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Global Warming');
${GUARD}
ROLLBACK;`);
    expect(r.status).not.toBe(0);
    expect(r.stderr.toLowerCase()).toContain('guard failed migrate-028');
    expect(r.stdout).toContain('VIOLATION');
    for (const row of (await woodRows()).filter((x) => x.substance_name === 'Wood')) {
      expect(parseFloat(row.factor_value)).toBe(94.956);
    }
  });

  it('the guard fails loudly on a per-kg factor on an MMBtu fuel, and nothing persists', async () => {
    const r = mysqlCli(`START TRANSACTION;
INSERT INTO driver_impact_factors (substance_id, category_id, method_name, factor_value, unit, geographic_scope, factor_basis, source_reference)
SELECT s.substance_id, ic.category_id, 'GUARDTEST', 0.008, 'kg SO2 eq / kg', 'Global', 'embodied', 'guard test'
  FROM substances s JOIN impact_categories ic ON ic.category_name = 'Acidification'
 WHERE s.substance_name = 'Coal';
${GUARD}
ROLLBACK;`);
    expect(r.status).not.toBe(0);
    expect(r.stderr.toLowerCase()).toContain('guard failed migrate-028');
    expect(r.stdout).toMatch(/Coal\s+MMBtu\s+Acidification\s+GUARDTEST/);
    const [[{ n }]]: any = await conn.query(`SELECT COUNT(*) AS n FROM driver_impact_factors WHERE method_name = 'GUARDTEST'`);
    expect(Number(n)).toBe(0);
  });

  it('the guard passes on the live data as it stands', () => {
    const r = mysqlCli(`START TRANSACTION;\n${GUARD}\nROLLBACK;`);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('migrate-028 guard passed');
  });

  it('migrate-029 records the GWP vintage per method without changing TRACI methane', async () => {
    const [rows]: any = await conn.query(
      `SELECT method_name, factor_group, gwp_vintage, evidence, decision_needed FROM lcia_gwp_vintage`,
    );
    const get = (m: string, g: RegExp) => rows.find((r: any) => r.method_name === m && g.test(r.factor_group));
    expect(get('TRACI 2.1', /lciafmt/).gwp_vintage).toBe('IPCC AR4');
    expect(get('TRACI 2.1', /lciafmt/).evidence).toContain('CH4 25, N2O 298, SF6 22800');
    expect(get('TRACI 2.1', /lciafmt/).decision_needed).toMatch(/keep AR4/);
    expect(get('TRACI 2.1', /EPA GHG Hub/).gwp_vintage).toBe('IPCC AR5');
    expect(get('TRACI 2.1', /EPA GHG Hub/).evidence).toContain('Wood 94.956');
    expect(get('CML 2001', /GHG characterization/).gwp_vintage).toBe('IPCC AR5');
    expect(get('ReCiPe Midpoint (H)', /GHG characterization/).gwp_vintage).toMatch(/^mixed/);
    expect(get('CML 2001', /R-410A/).gwp_vintage).toBe('IPCC AR4');
    const [[ch4]]: any = await conn.query(
      `SELECT d.factor_value FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
        WHERE s.substance_name = 'Methane' AND d.method_name = 'TRACI 2.1'
          AND d.category_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Global Warming')`,
    );
    expect(parseFloat(ch4.factor_value)).toBe(25);
  });
});
