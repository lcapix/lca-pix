/**
 * Grid-factor sync against the LOCAL dev database (audit INT-2).
 *
 * Run with:  LOCAL_DB=1 npx vitest run tests/e2e-local
 * Skipped unless LOCAL_DB=1 and DATABASE_HOST is a loopback address.
 *
 * With a live reading available (fetch is stubbed; no network), the audited
 * US (eGRID 2023) and Global (Ember 2024) electricity factors must stay
 * exactly as they are. Rows the test adds are deleted afterwards.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import mysql from 'mysql2/promise';
import { syncZoneFactor } from '@/lib/integrations/electricity-maps/sync';
import pool from '@/lib/db';

const host = process.env.DATABASE_HOST ?? '';
const enabled = process.env.LOCAL_DB === '1' && ['127.0.0.1', 'localhost', '::1'].includes(host);
const d = describe.skipIf(!enabled);

let conn: mysql.Connection;
let maxIdBefore = 0;
const origFetch = global.fetch;
const origKey = process.env.ELECTRICITY_MAPS_API_KEY;

async function electricityGw(scope: string, method: string) {
  const [r]: any = await conn.query(
    `SELECT d.factor_id, d.factor_value, d.source_reference
       FROM driver_impact_factors d
       JOIN impact_categories ic ON ic.category_id = d.category_id
      WHERE d.substance_id = (SELECT substance_id FROM substances
                               WHERE LOWER(substance_name) IN ('electricity','electricity, grid mix')
                               ORDER BY substance_id LIMIT 1)
        AND LOWER(ic.category_name) LIKE '%global warming%'
        AND d.method_name = ? AND d.geographic_scope = ?`,
    [method, scope],
  );
  return r[0] ?? null;
}

d('electricity sync on the local DB', () => {
  beforeAll(async () => {
    conn = await mysql.createConnection({
      host,
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME,
      port: +(process.env.DATABASE_PORT || 3306),
    });
    const [[m]]: any = await conn.query('SELECT COALESCE(MAX(factor_id), 0) AS m FROM driver_impact_factors');
    maxIdBefore = Number(m.m);
    process.env.ELECTRICITY_MAPS_API_KEY = 'test-key-not-real';
    global.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ zone: 'X', carbonIntensity: 410, datetime: '', updatedAt: '' }),
    })) as any;
  });

  afterAll(async () => {
    global.fetch = origFetch;
    if (origKey === undefined) delete process.env.ELECTRICITY_MAPS_API_KEY;
    else process.env.ELECTRICITY_MAPS_API_KEY = origKey;
    if (conn) {
      await conn.query(
        `DELETE FROM driver_impact_factors
          WHERE factor_id > ? AND source_reference LIKE 'Electricity Maps API %'`,
        [maxIdBefore],
      );
      await conn.end();
    }
    await pool.end();
  });

  it.each([
    ['US', 'CML 2001'],
    ['US', 'TRACI 2.1'],
    ['Global', 'CML 2001'],
    ['EU', 'ReCiPe Midpoint (H)'],
  ])('a live reading leaves the audited %s / %s factor untouched', async (zone, method) => {
    const before = await electricityGw(zone, method);
    expect(before, 'audited row expected on file').not.toBeNull();

    const r = await syncZoneFactor(zone, method);

    expect(r.inserted).toBe(false);
    expect(await electricityGw(zone, method)).toEqual(before);
  });
});
