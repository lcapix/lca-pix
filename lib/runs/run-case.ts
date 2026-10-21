/**
 * One assessment run of a case, on the caller's connection, so it is part of
 * the caller's transaction: the run row, the engine pass, the stored results
 * and the frozen snapshot (v3) commit together or not at all. Used by
 * POST /api/cases/[caseId]/assessments and by the sample builder.
 *
 * The caller checks access, the rate limit and the method; this only runs.
 */

import { calculateCaseImpacts, type LCAResult } from '@/lib/lca-engine';
import { log } from '@/lib/observability/log';
import { buildRunSnapshot, type GoalScope, type RunSnapshot } from '@/lib/run-snapshot';

/** Result rows per INSERT: a 1,000-step case stores thousands, one statement each was most of its run. */
const RESULT_ROWS_PER_INSERT = 500;

type Conn = { query: (sql: string, params?: unknown[]) => Promise<any> };

export interface RunCaseArgs {
  caseId: number;
  caseName?: string;
  runName: string;
  /** A canonical method (canonicalMethod). */
  method: string;
  /** A canonical region (canonicalizeRegion). */
  regionCode: string;
  userId: number;
  goalScope: GoalScope | null;
  /** Quiet for builders that run several cases. */
  quiet?: boolean;
}

export async function runCaseInTransaction(
  conn: Conn,
  { caseId, runName, method, regionCode, userId, goalScope, quiet }: RunCaseArgs,
): Promise<{ runId: number; lcaResult: LCAResult; snapshot: RunSnapshot }> {
  const [runResult] = await conn.query(
    `INSERT INTO assessment_runs (case_id, run_name, calculation_method, region_code, status, executed_by)
     VALUES (?, ?, ?, ?, 'running', ?)`,
    [caseId, runName, method, regionCode, userId],
  );
  const runId = Number((runResult as any).insertId);

  // Run LCA calculation using the core engine
  const started = performance.now();
  const lcaResult: LCAResult = await calculateCaseImpacts(caseId, conn as any, { method, regionCode });

  // Store results in database, in multi-row INSERTs (same rows, same order).
  const resultRows = lcaResult.component_results.flatMap((compResult) =>
    compResult.impacts.map((impact) => [runId, compResult.component_id, impact.category_id, impact.impact_value, impact.unit]),
  );
  for (let i = 0; i < resultRows.length; i += RESULT_ROWS_PER_INSERT) {
    const chunk = resultRows.slice(i, i + RESULT_ROWS_PER_INSERT);
    await conn.query(
      `INSERT INTO assessment_results
       (run_id, component_id, category_id, impact_value, unit)
       VALUES ${chunk.map(() => '(?, ?, ?, ?, ?)').join(', ')}`,
      chunk.flat(),
    );
  }

  // Freeze what this run computed AND what it was computed from: totals,
  // every step (id, name, parent, stage, per-category values, costs) and
  // every flow as entered (snapshot v3), read inside the same transaction
  // as the engine so they describe exactly the inventory it used.
  const [components] = await conn.query(
    `SELECT * FROM component WHERE case_id = ? ORDER BY hierarchy_level, component_id`,
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
  // How each cost was built (migrate-035); a database without it freezes none.
  let costBasis: any[] | undefined;
  try {
    const [basisRows] = await conn.query(
      `SELECT b.* FROM component_cost_basis b
         JOIN component c ON c.component_id = b.component_id
        WHERE c.case_id = ?`,
      [caseId],
    );
    costBasis = basisRows as any[];
  } catch (basisErr: any) {
    if (basisErr?.code !== 'ER_NO_SUCH_TABLE') throw basisErr;
  }
  const snapshot = buildRunSnapshot(lcaResult, method, regionCode, goalScope, {
    components: components as any[],
    flows: flows as any[],
    costBasis,
  });

  await conn.query(`UPDATE assessment_runs SET status = 'completed', run_snapshot = ? WHERE run_id = ?`, [
    JSON.stringify(snapshot),
    runId,
  ]);

  // One line per run. The engine's step-by-step trace is in the result
  // (algorithm_steps), not the server log: for a 1,000-step case it ran to
  // some 20,000 lines a run.
  if (!quiet) {
    log('info', 'run completed', {
      run_id: runId,
      case_id: caseId,
      method,
      region: regionCode,
      steps: lcaResult.summary.total_components,
      steps_with_flows: lcaResult.summary.components_with_flows,
      flows: lcaResult.summary.total_flows_processed,
      categories: lcaResult.summary.impact_categories_calculated,
      result_rows: resultRows.length,
      ms: Math.round(performance.now() - started),
    });
  }
  return { runId, lcaResult, snapshot };
}
