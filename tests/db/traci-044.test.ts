/**
 * K01 K02: migrate-044 adds TRACI 2.1's cancer and particulate matter
 * categories to a fresh database, touches no existing factor, and a second
 * run changes nothing.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MIGRATIONS_DIR } from '../../scripts/db/migrate.mjs';
import { connect, createDb, dropDb, rows, sqlFile } from './support/db';

const FILE = path.join(MIGRATIONS_DIR, 'migrate-044-traci-cancer-pm.sql');

let dbName: string;
let conn: Awaited<ReturnType<typeof connect>>;

/** Every factor row as it is: the count and one checksum over all of them. */
async function factorPrint(where = 'TRUE') {
  const [r] = await rows<{ n: string; sum: string }>(
    conn,
    `SELECT count(*) AS n,
            md5(coalesce(string_agg(concat_ws('|', factor_id, substance_id, category_id, method_name, factor_value::text,
              unit, geographic_scope, factor_basis, source_reference), ',' ORDER BY factor_id), '')) AS sum
       FROM driver_impact_factors WHERE ${where}`,
  );
  return r;
}

describe('migrate-044 on a fresh database', () => {
  beforeAll(async () => {
    dbName = createDb(['--no-migrate']);
    conn = await connect(dbName);
  });
  afterAll(async () => {
    await conn?.end();
    if (dbName) dropDb(dbName);
  });

  it('names the script, the source and its sha256 in the header', () => {
    const head = readFileSync(FILE, 'utf8').split('\n').slice(0, 5).join('\n');
    expect(head).toContain('scripts/factor-import/build_traci_sql.py');
    expect(head).toContain('TRACI_2.1_v1.0.0_5555779.parquet');
    expect(head).toContain('e1f43a0266e1a844e69da633c58c69685cb0996ca446e24f9b7f0df9d0cedee5');
  });

  it('K01 K02 adds both categories and their factors, and changes no existing factor', async () => {
    const before = await factorPrint();
    const sql = readFileSync(FILE, 'utf8');
    const r = await sqlFile(dbName, sql);
    expect(r.error).toBe('');

    const cats = await rows<{ category_name: string; abbreviation: string; unit: string }>(
      conn,
      `SELECT category_name, abbreviation, unit FROM impact_categories
        WHERE category_name IN ('Human Health - Cancer', 'Particulate Matter') ORDER BY category_name`,
    );
    expect(cats).toEqual([
      { category_name: 'Human Health - Cancer', abbreviation: 'HTc', unit: 'CTUcancer' },
      { category_name: 'Particulate Matter', abbreviation: 'PM', unit: 'PM 2.5 eq' },
    ]);
    const per = await rows<{ category_name: string; n: string }>(
      conn,
      `SELECT ic.category_name, count(*) AS n FROM driver_impact_factors d
         JOIN impact_categories ic ON ic.category_id = d.category_id
        WHERE ic.category_name IN ('Human Health - Cancer', 'Particulate Matter') AND d.method_name = 'TRACI 2.1'
        GROUP BY ic.category_name ORDER BY ic.category_name`,
    );
    // 609 flowables for cancer less the 8 the header lists; all 8 for particulate matter, plus the
    // library's own PM2.5, NOx and SO2 (review finding: a flow picked from the library must not read 0).
    expect(per.map((p) => [p.category_name, Number(p.n)])).toEqual([
      ['Human Health - Cancer', 601],
      ['Particulate Matter', 11],
    ]);
    const lib = await rows<{ substance_name: string; v: string }>(
      conn,
      `SELECT s.substance_name, d.factor_value::text AS v FROM driver_impact_factors d
         JOIN substances s ON s.substance_id = d.substance_id
         JOIN impact_categories ic ON ic.category_id = d.category_id
        WHERE ic.category_name = 'Particulate Matter' AND s.substance_name IN ('Particulate Matter (PM2.5)', 'Nitrogen oxides (NOx)', 'Sulfur dioxide (SO2)', 'Particulate matter (PM10)')
        ORDER BY s.substance_name`,
    );
    expect(lib.map((r) => [r.substance_name, Number(r.v)])).toEqual([
      ['Nitrogen oxides (NOx)', 0.0072222222],
      ['Particulate Matter (PM2.5)', 1],
      ['Sulfur dioxide (SO2)', 0.0611111111],
    ]);

    const old = `category_id NOT IN (SELECT category_id FROM impact_categories WHERE category_name IN ('Human Health - Cancer', 'Particulate Matter'))`;
    expect(await factorPrint(old)).toEqual(before);

    // A second run changes nothing anywhere.
    const once = { factors: await factorPrint(), subs: await rows(conn, 'SELECT count(*) AS n FROM substances'), cats: await rows(conn, 'SELECT count(*) AS n FROM impact_categories') };
    expect((await sqlFile(dbName, sql)).error).toBe('');
    expect({ factors: await factorPrint(), subs: await rows(conn, 'SELECT count(*) AS n FROM substances'), cats: await rows(conn, 'SELECT count(*) AS n FROM impact_categories') }).toEqual(once);
  });

  it('K01 keeps the parquet value: Benzene to air (emission/air row 160469) is 2.970256e-07 CTUcancer per kg', async () => {
    const [f] = await rows<{ v: string; unit: string }>(
      conn,
      `SELECT d.factor_value::text AS v, d.unit FROM driver_impact_factors d
         JOIN substances s ON s.substance_id = d.substance_id
         JOIN impact_categories ic ON ic.category_id = d.category_id
        WHERE s.substance_name = 'Benzene' AND ic.category_name = 'Human Health - Cancer' AND d.method_name = 'TRACI 2.1'
        LIMIT 1`,
    );
    expect(f.unit).toBe('CTUcancer');
    expect(Number(f.v)).toBeCloseTo(2.970256e-7, 10);
  });
});
