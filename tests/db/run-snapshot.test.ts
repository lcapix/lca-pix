/**
 * Snapshot immutability at the database level (RUN-1, STAGE-2, EXP-1).
 *
 * Builds a case with plain SQL, runs the real engine and freezes the run the
 * way POST /api/cases/:caseId/assessments does (same statements, same
 * lib/run-snapshot helpers, one transaction), then deletes a step. The run's
 * frozen totals, per-step rows and flow detail must not move, and its stored
 * result rows must survive with component_id set to NULL (migrate-027).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { calculateCaseImpacts } from '@/lib/lca-engine';
import {
  SNAPSHOT_VERSION,
  buildGoalScope,
  buildRunSnapshot,
  hasFrozenResults,
  parseRunSnapshot,
  snapshotComponentBreakdown,
  snapshotImpacts,
  snapshotReportParts,
  snapshotResultRows,
} from '@/lib/run-snapshot';
import { connect, rows } from './support/db';
import { createAccount, substanceId } from './support/world';

let conn: Awaited<ReturnType<typeof connect>>;
let accountId: number;
let projectId: number;
let caseId: number;
let runId: number;
const step: Record<string, number> = {};

async function insert(sql: string, params: unknown[]) {
  const [r] = await conn.query(sql, params);
  return (r as { insertId: number }).insertId;
}

/** The assessments route's run transaction, minus HTTP and logging. */
async function runAssessment(method: string, regionCode: string) {
  const [[project]] = (await conn.query('SELECT * FROM project WHERE project_id = ?', [projectId])) as any;
  const [[caseRow]] = (await conn.query('SELECT * FROM case_table WHERE case_id = ?', [caseId])) as any;
  const goalScope = buildGoalScope(project, caseRow);
  await conn.beginTransaction();
  try {
    const id = await insert(
      `INSERT INTO assessment_runs (case_id, run_name, calculation_method, region_code, status, executed_by)
       VALUES (?, ?, ?, ?, 'running', ?)`,
      [caseId, 'db snapshot test', method, regionCode, accountId],
    );
    const lcaResult = await calculateCaseImpacts(caseId, conn, { method, regionCode });
    for (const compResult of lcaResult.component_results) {
      for (const impact of compResult.impacts) {
        await conn.query(
          `INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES (?, ?, ?, ?, ?)`,
          [id, compResult.component_id, impact.category_id, impact.impact_value, impact.unit],
        );
      }
    }
    const [components] = await conn.query(
      'SELECT * FROM component WHERE case_id = ? ORDER BY hierarchy_level, component_id',
      [caseId],
    );
    const [flows] = await conn.query(
      `SELECT f.flow_id, f.component_id, c.component_name, f.substance_id, s.substance_name,
              f.flow_type, f.quantity, f.unit
         FROM flows f
         JOIN component c ON c.component_id = f.component_id
         LEFT JOIN substances s ON s.substance_id = f.substance_id
        WHERE c.case_id = ?
        ORDER BY c.hierarchy_level, c.component_id, f.flow_type, f.flow_id`,
      [caseId],
    );
    const snapshot = buildRunSnapshot(lcaResult, method, regionCode, goalScope, {
      components: components as any[],
      flows: flows as any[],
    });
    await conn.query(`UPDATE assessment_runs SET status = 'completed', run_snapshot = ? WHERE run_id = ?`, [
      JSON.stringify(snapshot),
      id,
    ]);
    await conn.commit();
    return { id, lcaResult };
  } catch (e) {
    await conn.rollback();
    throw e;
  }
}

async function readRun() {
  const [[run]] = (await conn.query(
    'SELECT run_snapshot, CAST(run_snapshot AS CHAR) AS raw, status FROM assessment_runs WHERE run_id = ?',
    [runId],
  )) as any;
  const snap = parseRunSnapshot(run.run_snapshot);
  if (!hasFrozenResults(snap)) throw new Error('run has no v3 snapshot');
  const results = await rows<{ component_id: number | null; category_id: number; impact_value: number }>(
    conn,
    'SELECT component_id, category_id, impact_value FROM assessment_results WHERE run_id = ? ORDER BY result_id',
    [runId],
  );
  return {
    raw: String(run.raw),
    status: run.status,
    snap,
    impacts: snapshotImpacts(snap),
    breakdown: snapshotComponentBreakdown(snap),
    resultRows: snapshotResultRows(snap),
    report: snapshotReportParts(snap),
    results,
  };
}

beforeAll(async () => {
  conn = await connect();
  accountId = await createAccount(conn, 'snapshot');
  projectId = await insert(
    `INSERT INTO project (project_name, owner_id, functional_unit, lcia_method, region_code) VALUES ('db snapshot test', ?, '1 mug', 'CML 2001', 'US')`,
    [accountId],
  );
  caseId = await insert(
    `INSERT INTO case_table (project_id, case_name, case_type, region_code) VALUES (?, 'Standard Production', 'base', 'US')`,
    [projectId],
  );
  const add = (name: string, type: string, level: number, parent: number | null, stage: string | null) =>
    insert(
      `INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, life_cycle_stage)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [caseId, parent, name, type, level, stage],
    );
  step.product = await add('Ceramic Coffee Mug (350ml)', 'product', 1, null, null);
  step.line = await add('Forming Line', 'machine_line', 2, step.product, 'production');
  step.casting = await add('Slip Casting', 'subprocess', 3, step.line, 'production');
  step.filling = await add('Mold Filling', 'operation', 4, step.casting, 'production');
  step.cleaning = await add('Mold Cleaning', 'operation', 4, step.casting, 'use');
  const electricity = await substanceId(conn, 'Electricity');
  const gas = await substanceId(conn, 'Natural Gas');
  await insert(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit) VALUES (?, ?, 'input', 2.5, 'kWh')`, [
    step.cleaning,
    electricity,
  ]);
  await insert(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit) VALUES (?, ?, 'input', 1.8, 'm3')`, [
    step.filling,
    gas,
  ]);
  runId = (await runAssessment('CML 2001', 'US')).id;
});

afterAll(async () => {
  if (projectId) await conn.query('DELETE FROM project WHERE project_id = ?', [projectId]);
  if (accountId) await conn.query('DELETE FROM account WHERE id = ?', [accountId]);
  await conn?.end();
});

describe('a frozen run survives deleting a step', () => {
  let before: Awaited<ReturnType<typeof readRun>>;

  it('the run is completed with a v3 snapshot whose totals match the stored result rows', async () => {
    before = await readRun();
    expect(before.status).toBe('completed');
    expect(before.snap.version).toBe(SNAPSHOT_VERSION);
    // Electricity (US grid 0.350 kg/kWh) x 2.5 + natural gas 1.877 kg/m3 x 1.8.
    expect(before.impacts['Global Warming'].value).toBeCloseTo(0.35 * 2.5 + 1.877 * 1.8, 9);
    const stepIds = before.breakdown.map((b) => b.component_id).sort((a, b) => a - b);
    expect(stepIds).toEqual([step.filling, step.cleaning].sort((a, b) => a - b));
    // Stored rows add up to the frozen totals, per category.
    for (const t of before.snap.totals) {
      const stored = before.results.filter((r) => r.category_id === t.category_id).reduce((s, r) => s + r.impact_value, 0);
      expect(stored, t.category_name).toBeCloseTo(t.value, 12);
    }
    expect(before.results.every((r) => r.component_id !== null)).toBe(true);
  });

  it('deleting a step (and its flows) changes nothing the run reports', async () => {
    const [del] = await conn.query('DELETE FROM component WHERE component_id = ?', [step.filling]);
    expect((del as { affectedRows: number }).affectedRows).toBe(1);
    const [[live]] = (await conn.query(
      `SELECT COUNT(*) AS n FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ?`,
      [caseId],
    )) as any;
    expect(Number(live.n)).toBe(1); // the live case lost the gas flow

    const after = await readRun();
    expect(after.raw).toBe(before.raw); // the snapshot column is byte-identical
    expect(after.impacts).toEqual(before.impacts);
    expect(after.breakdown).toEqual(before.breakdown);
    expect(after.resultRows).toEqual(before.resultRows);
    expect(after.report).toEqual(before.report);
    // The deleted step is still named, staged and costed in the frozen run.
    const filling = after.snap.steps.find((s) => s.component_id === step.filling);
    expect(filling).toMatchObject({ name: 'Mold Filling', stage: 'production' });
    expect(after.snap.flow_detail.some((f) => f.component_id === step.filling && f.substance === 'Natural Gas')).toBe(true);
  });

  it('the stored result rows survive with component_id NULL, and still add up to the frozen totals', async () => {
    const after = await readRun();
    expect(after.results.length).toBe(before.results.length);
    const orphaned = after.results.filter((r) => r.component_id === null);
    const wasFilling = before.results.filter((r) => r.component_id === step.filling);
    expect(wasFilling.length).toBeGreaterThan(0);
    expect(orphaned.length).toBe(wasFilling.length);
    expect(orphaned.map((r) => r.impact_value).sort()).toEqual(wasFilling.map((r) => r.impact_value).sort());
    for (const t of after.snap.totals) {
      const stored = after.results.filter((r) => r.category_id === t.category_id).reduce((s, r) => s + r.impact_value, 0);
      expect(stored, t.category_name).toBeCloseTo(t.value, 12);
    }
  });

  it('a new run on the edited case reflects the edit; the old one does not', async () => {
    const { id } = await runAssessment('CML 2001', 'US');
    const [[run]] = (await conn.query('SELECT run_snapshot FROM assessment_runs WHERE run_id = ?', [id])) as any;
    const snap = parseRunSnapshot(run.run_snapshot)!;
    expect(snapshotImpacts(snap)['Global Warming'].value).toBeCloseTo(0.35 * 2.5, 9);
    expect((await readRun()).impacts['Global Warming'].value).toBeCloseTo(0.35 * 2.5 + 1.877 * 1.8, 9);
  });
});
