/**
 * Small values survive the database (RUN-2).
 *
 * assessment_results.impact_value is DOUBLE since migrate-026, so an
 * ozone-depletion-scale result (4.2e-7 kg CFC-11 eq) reads back as written.
 * flows.quantity is DECIMAL(15,6) in the baseline, which stores 4.2e-7 as 0;
 * migrate-030 is expected to widen it. Until a migrate-030 file exists in the
 * repo the flows check is skipped, and says so.
 */
import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ROOT, connect, rows } from './support/db';
import { seedWorld, type World } from './support/world';

const MIGRATE_030 = readdirSync(ROOT).find((f) => /^migrate-030-.+\.sql$/.test(f));

let conn: Awaited<ReturnType<typeof connect>>;
let world: World;
let runId: number;
let categoryId: number;

beforeAll(async () => {
  conn = await connect();
  world = await seedWorld(conn);
  const [r] = await conn.query(
    `INSERT INTO assessment_runs (case_id, run_name, status, executed_by) VALUES (?, 'precision', 'completed', ?)`,
    [world.cases[0].caseId, world.ownerId],
  );
  runId = (r as { insertId: number }).insertId;
  const [[cat]] = (await conn.query(`SELECT category_id FROM impact_categories WHERE category_name = 'Ozone Depletion'`)) as any;
  categoryId = cat.category_id;
});

afterAll(async () => {
  await world?.cleanup();
  await conn?.end();
});

const relClose = (actual: number, expected: number, rel = 1e-12) =>
  Math.abs(actual - expected) <= Math.abs(expected) * rel;

describe('precision of stored values', () => {
  it.each([4.2e-7, 4.2e-9, 1.5e-15, 0.1 + 0.2, 123456789.123456789, 6.02214076e23])(
    'assessment_results.impact_value keeps %d exactly',
    async (value) => {
      const [r] = await conn.query(
        `INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit, contribution_percentage)
         VALUES (?, ?, ?, ?, 'kg CFC-11 eq', ?)`,
        [runId, world.cases[0].leafId, categoryId, value, 0.004],
      );
      const id = (r as { insertId: number }).insertId;
      const [row] = await rows<{ impact_value: number; contribution_percentage: number }>(
        conn,
        'SELECT impact_value, contribution_percentage FROM assessment_results WHERE result_id = ?',
        [id],
      );
      expect(row.impact_value).toBe(value);
      expect(row.contribution_percentage).toBe(0.004); // was DECIMAL(5,2): 0.00
    },
  );

  it('4.2e-7 survives a SUM over result rows (the results API aggregates)', async () => {
    const [row] = await rows<{ total: number }>(
      conn,
      'SELECT SUM(impact_value) AS total FROM assessment_results WHERE run_id = ? AND impact_value < 1e-6',
      [runId],
    );
    expect(relClose(Number(row.total), 4.2e-7 + 4.2e-9 + 1.5e-15)).toBe(true);
  });

  it.skipIf(!MIGRATE_030)(
    `flows.quantity keeps 4.2e-7${MIGRATE_030 ? ` (${MIGRATE_030})` : ' (SKIPPED: no migrate-030-*.sql in the repo yet; flows.quantity is still DECIMAL(15,6) and stores it as 0)'}`,
    async () => {
      const [r] = await conn.query(
        `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit)
         SELECT ?, substance_id, 'output', ?, 'kg' FROM substances WHERE substance_name = 'Methane'`,
        [world.cases[0].leafId, 4.2e-7],
      );
      const [row] = await rows<{ quantity: string | number }>(conn, 'SELECT quantity FROM flows WHERE flow_id = ?', [
        (r as { insertId: number }).insertId,
      ]);
      expect(relClose(Number(row.quantity), 4.2e-7)).toBe(true);
    },
  );

  it('documents the flows.quantity column type in force', async () => {
    const [c] = await rows<{ COLUMN_TYPE: string }>(
      conn,
      `SELECT LOWER(COLUMN_TYPE) AS COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flows' AND COLUMN_NAME = 'quantity'`,
    );
    if (!MIGRATE_030) {
      console.warn(
        `[precision] migrate-030 has not landed: flows.quantity is ${c.COLUMN_TYPE}, so a flow of 4.2e-7 is stored as 0. The flows round-trip test is skipped.`,
      );
      expect(c.COLUMN_TYPE).toBe('decimal(15,6)');
    } else {
      expect(c.COLUMN_TYPE).not.toBe('decimal(15,6)');
    }
  });
});
