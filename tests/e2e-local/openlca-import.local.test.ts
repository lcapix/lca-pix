/**
 * openLCA import against the LOCAL dev database (audit E2 / H1).
 *
 * Run with:  LOCAL_DB=1 npx vitest run tests/e2e-local
 * Skipped unless LOCAL_DB=1 and DATABASE_HOST is a loopback address, so it can
 * never run against a shared or production database.
 *
 * Re-running every seed file must not change a single existing factor row and
 * must not bring back anything migrations 017/024 quarantined. Any rows the
 * import does add (genuinely missing ones) are deleted again afterwards.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';
import { importFactorMethod } from '@/lib/integrations/openlca/import';
import { CML_2001_V4_FACTORS } from '@/lib/integrations/openlca/data/cml-2001-v4';
import { RECIPE_MIDPOINT_H_FACTORS } from '@/lib/integrations/openlca/data/recipe-midpoint-h';
import { TRACI_21_FACTORS } from '@/lib/integrations/openlca/data/traci-2.1';
import pool from '@/lib/db';

const host = process.env.DATABASE_HOST ?? '';
const enabled = process.env.LOCAL_DB === '1' && ['127.0.0.1', 'localhost', '::1'].includes(host);
const d = describe.skipIf(!enabled);

const LIVE = ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'];

let conn: mysql.Connection;
let maxIdBefore = 0;
let snapshot = new Map<number, string>();

async function rows() {
  const [r]: any = await conn.query(
    `SELECT factor_id, substance_id, category_id, method_name, geographic_scope,
            factor_value, unit, source_reference, factor_basis
       FROM driver_impact_factors`,
  );
  return r as any[];
}

const fingerprint = (r: any) =>
  JSON.stringify([r.substance_id, r.category_id, r.method_name, r.geographic_scope,
    String(r.factor_value), r.unit, r.source_reference, r.factor_basis]);

async function liveRowsWithQuarantineTwin(): Promise<number> {
  const [[r]]: any = await conn.query(
    `SELECT COUNT(*) AS n
       FROM driver_impact_factors live
       JOIN driver_impact_factors q
         ON q.substance_id = live.substance_id
        AND q.category_id  = live.category_id
        AND q.method_name  = CONCAT('QUARANTINE: ', live.method_name)
      WHERE live.method_name IN (?, ?, ?)`,
    LIVE,
  );
  return Number(r.n);
}

d('openLCA import on the local DB', () => {
  beforeAll(async () => {
    conn = await mysql.createConnection({
      host,
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME,
      port: +(process.env.DATABASE_PORT || 3306),
    });
    const before = await rows();
    maxIdBefore = Math.max(0, ...before.map((r) => r.factor_id));
    snapshot = new Map(before.map((r) => [r.factor_id, fingerprint(r)]));
  });

  afterAll(async () => {
    if (conn) {
      // Remove only what this test inserted.
      await conn.query(
        `DELETE FROM driver_impact_factors WHERE factor_id > ? AND source_reference LIKE 'openLCA %'`,
        [maxIdBefore],
      );
      await conn.end();
    }
    await pool.end();
  });

  it('re-importing all three methods leaves every existing row untouched and restores no quarantined row', async () => {
    const twinsBefore = await liveRowsWithQuarantineTwin();

    const results = [
      await importFactorMethod('CML 2001', CML_2001_V4_FACTORS),
      await importFactorMethod('ReCiPe Midpoint (H)', RECIPE_MIDPOINT_H_FACTORS),
      await importFactorMethod('TRACI 2.1', TRACI_21_FACTORS),
    ];
    for (const r of results) expect(r.errors).toEqual([]);
    // The quarantined TRACI rows the audit names (e.g. NOx eutrophication in kg PO4 eq) are skipped.
    expect(results[2].skippedQuarantined).toBeGreaterThan(0);

    const after = await rows();
    for (const r of after) {
      if (r.factor_id <= maxIdBefore) {
        expect(fingerprint(r), `factor ${r.factor_id} changed`).toBe(snapshot.get(r.factor_id));
      }
    }
    expect(await liveRowsWithQuarantineTwin()).toBe(twinsBefore);
  });
});
