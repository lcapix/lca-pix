/**
 * RUN-2: assessment_results.impact_value must keep full precision.
 *
 * Run with:  LOCAL_DB=1 npx vitest run tests/e2e-local
 * Needs migrate-026-result-values-double.sql applied to the local database.
 *
 * DECIMAL(20,6) (the schema file) stored anything below 5e-7 as 0, and the
 * DECIMAL(20,10) some databases carry still rounds ozone-depletion-scale values
 * (kg CFC-11 eq). DOUBLE keeps what the engine computed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mysql from 'mysql2/promise';

const enabled = process.env.LOCAL_DB === '1';
const d = describe.skipIf(!enabled);

const MARK = `precision-e2e-${Date.now()}`;
let conn: mysql.Connection;
let projectId: number;
let runId: number;
let componentId: number;
let categoryId: number;

d('assessment_results precision (local DB, post-migration-026)', () => {
  beforeAll(async () => {
    conn = await mysql.createConnection({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'lca_v3',
      port: +(process.env.DATABASE_PORT || 3306),
    });
    const [[acct]]: any = await conn.query(`SELECT id FROM account ORDER BY id LIMIT 1`);
    const [p]: any = await conn.query(
      `INSERT INTO project (project_name, description, owner_id) VALUES (?, 'precision e2e throwaway', ?)`,
      [MARK, acct.id],
    );
    projectId = p.insertId;
    const [c]: any = await conn.query(
      `INSERT INTO case_table (project_id, case_name, case_type) VALUES (?, ?, 'base')`,
      [projectId, MARK],
    );
    const [k]: any = await conn.query(
      `INSERT INTO component (case_id, component_name, component_type, hierarchy_level)
       VALUES (?, ?, 'product', 1)`,
      [c.insertId, MARK],
    );
    componentId = k.insertId;
    const [r]: any = await conn.query(
      `INSERT INTO assessment_runs (case_id, run_name, status, executed_by) VALUES (?, ?, 'completed', ?)`,
      [c.insertId, MARK, acct.id],
    );
    runId = r.insertId;
    const [[cat]]: any = await conn.query(`SELECT category_id FROM impact_categories ORDER BY category_id LIMIT 1`);
    categoryId = cat.category_id;
  });

  afterAll(async () => {
    if (projectId) await conn.query(`DELETE FROM project WHERE project_id = ?`, [projectId]);
    await conn.end();
  });

  it('stores impact_value as DOUBLE', async () => {
    const [[col]]: any = await conn.query(
      `SELECT DATA_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assessment_results' AND COLUMN_NAME = 'impact_value'`,
    );
    expect(String(col.DATA_TYPE).toLowerCase()).toBe('double');
  });

  it.each([4.2e-7, 4.2e-12, 1.23456789012e-7, -3.3e-9, 88730.123456789])(
    'round-trips %s exactly',
    async (value) => {
      const [ins]: any = await conn.query(
        `INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
         VALUES (?, ?, ?, ?, 'kg CFC-11 eq')`,
        [runId, componentId, categoryId, value],
      );
      const [[row]]: any = await conn.query(
        `SELECT impact_value FROM assessment_results WHERE result_id = ?`,
        [ins.insertId],
      );
      expect(Number(row.impact_value)).toBe(value);
    },
  );
});
