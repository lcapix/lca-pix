/**
 * Has a case changed after one of its runs? One rule for every screen that
 * says so (Compare's "Edited after this run", Home's "Base case changed after
 * Run #n", the workspace's Out of date line):
 *   - an edit: a step, a flow or an own factor updated after the run date;
 *   - a delete or a data-basis change: the run's frozen steps, flows, own
 *     factors and per-unit scale no longer match the case (snapshotDrift).
 */

import { query, queryOne } from '@/lib/db-helpers'
import { parseRunSnapshot } from '@/lib/run-snapshot'
import { snapshotDrift } from '@/lib/compare/run-results'

/** A step, flow or own factor of the run's case updated after the run. */
export async function editedAfterRun(runId: number): Promise<boolean> {
  const sql = (withOwn: boolean) =>
    `SELECT (
        EXISTS (SELECT 1 FROM component k WHERE k.case_id = r.case_id AND k.updated_at > r.run_date)
     OR EXISTS (SELECT 1 FROM flows f JOIN component k ON k.component_id = f.component_id
                 WHERE k.case_id = r.case_id AND f.updated_at > r.run_date)${
       withOwn
         ? `
     OR EXISTS (SELECT 1 FROM flow_factor_overrides o JOIN flows f ON f.flow_id = o.flow_id
                  JOIN component k ON k.component_id = f.component_id
                 WHERE k.case_id = r.case_id AND o.updated_at > r.run_date)`
         : ''
     }
     ) AS stale
       FROM assessment_runs r WHERE r.run_id = ?`
  let s: any
  try {
    s = await queryOne<any>(sql(true), [runId])
  } catch (err: any) {
    // A database without own factors (migrate-034) asks without them.
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err
    s = await queryOne<any>(sql(false), [runId])
  }
  return !!Number(s?.stale)
}

/** The full rule for one run of one case: an edit after it, or drift from what it froze. */
export async function caseChangedAfterRun(caseId: number, runId: number): Promise<boolean> {
  const run = await queryOne<any>(`SELECT run_id, run_snapshot FROM assessment_runs WHERE run_id = ? AND case_id = ?`, [runId, caseId])
  if (!run) return false
  if (await editedAfterRun(runId)) return true
  const [kase, comps, flows] = await Promise.all([
    queryOne<any>(`SELECT reference_flow, modeled_output FROM case_table WHERE case_id = ?`, [caseId]),
    query<any>(`SELECT component_id FROM component WHERE case_id = ?`, [caseId]),
    query<any>(`SELECT f.flow_id FROM flows f JOIN component k ON k.component_id = f.component_id WHERE k.case_id = ?`, [caseId]),
  ])
  let own: any[] = []
  try {
    own = await query<any>(
      `SELECT DISTINCT o.flow_id FROM flow_factor_overrides o JOIN flows f ON f.flow_id = o.flow_id
         JOIN component k ON k.component_id = f.component_id WHERE k.case_id = ?`,
      [caseId],
    )
  } catch (err: any) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err
  }
  return snapshotDrift(parseRunSnapshot(run.run_snapshot), {
    componentIds: comps.map((k) => Number(k.component_id)),
    flowIds: flows.map((f) => Number(f.flow_id)),
    referenceFlow: kase?.reference_flow ?? null,
    modeledOutput: kase?.modeled_output ?? null,
    ownFactorFlowIds: own.map((o) => Number(o.flow_id)),
  })
}
