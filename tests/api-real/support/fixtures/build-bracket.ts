/**
 * Test fixture, not shipped. Builds the bracket study (tests/fixtures/bracket-study.ts) in
 * one account, on the caller's connection, so the whole study commits or none
 * of it does: the project, the base case with its 17 steps, nine flows and
 * costs (each cost with its rate and source), a run, the "Shorter cure cycle"
 * what-if (a copy with one change) and its run. Needs migrations 033 to 039.
 */

import { copyCaseInventory, copyCaseReferenceFields } from '@/lib/case-copy'
import { COST_COLUMN } from '@/lib/costs/cost-basis'
import { canonicalizeRegion } from '@/lib/factor-selection'
import { buildGoalScope, canonicalMethod } from '@/lib/run-snapshot'
import { runCaseInTransaction } from '@/lib/runs/run-case'
import {
  SAMPLE_BASE_CASE,
  SAMPLE_PROJECT,
  SAMPLE_REFERENCE_VINTAGE,
  SAMPLE_STEPS,
  SAMPLE_WHAT_IF,
  TIER_LEVEL,
  sampleCostAmount,
} from '../../../fixtures/bracket-study'

type Conn = { query: (sql: string, params?: unknown[]) => Promise<any> }

export interface BuiltSample {
  projectId: number
  baseCaseId: number
  whatIfCaseId: number
  baseRunId: number
  whatIfRunId: number
}

/** A library substance the sample needs is missing (migration 039 not applied). */
export class SampleUnavailable extends Error {}

const rows = async (conn: Conn, sql: string, params: unknown[] = []) => (await conn.query(sql, params))[0] as any[]
const insertId = async (conn: Conn, sql: string, params: unknown[]) =>
  Number(((await conn.query(sql, params))[0] as any).insertId)

/** The library row for a name: the name itself, or "<name> (library)" (migrate-039). Never a private one. */
async function librarySubstance(conn: Conn, name: string): Promise<number> {
  const [row] = await rows(
    conn,
    `SELECT substance_id FROM substances
      WHERE is_custom = 0 AND substance_name IN (?, CAST(? AS text) || ' (library)')
      ORDER BY substance_name = ? DESC LIMIT 1`,
    [name, name, name],
  )
  if (!row) throw new SampleUnavailable(`The library has no "${name}" (needs migration 039).`)
  return Number(row.substance_id)
}

export async function buildSampleStudy(conn: Conn, userId: number): Promise<BuiltSample> {
  const method = canonicalMethod(SAMPLE_PROJECT.method)
  if (!method) throw new SampleUnavailable(`The factor table has no ${SAMPLE_PROJECT.method}.`)
  const region = canonicalizeRegion(SAMPLE_PROJECT.region)

  // Every substance first: a missing one stops the build before anything is written.
  const substanceIds = new Map<string, number>()
  for (const s of SAMPLE_STEPS) {
    for (const f of s.flows ?? []) {
      if (!substanceIds.has(f.substance)) substanceIds.set(f.substance, await librarySubstance(conn, f.substance))
    }
  }

  const projectId = await insertId(
    conn,
    `INSERT INTO project (project_name, description, owner_id, lcia_method, region_code,
                          goal_statement, functional_unit, system_boundary, boundary_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      SAMPLE_PROJECT.name,
      SAMPLE_PROJECT.description,
      userId,
      method,
      region,
      SAMPLE_PROJECT.goal,
      SAMPLE_PROJECT.functionalUnit,
      SAMPLE_PROJECT.boundary,
      SAMPLE_PROJECT.boundaryNotes,
    ],
  )
  const [owner] = await rows(conn, `SELECT permission_id FROM permissions WHERE permission_name = 'owner'`)
  if (owner?.permission_id != null) {
    await conn.query('INSERT INTO project_members (project_id, user_id, permission_id) VALUES (?, ?, ?)', [
      projectId,
      userId,
      owner.permission_id,
    ])
  }

  const baseCaseId = await insertId(
    conn,
    `INSERT INTO case_table (project_id, created_by, case_name, case_type, description, region_code,
                             reference_flow, reference_flow_unit, modeled_output)
     VALUES (?, ?, ?, 'base', ?, ?, ?, ?, ?)`,
    [
      projectId,
      userId,
      SAMPLE_BASE_CASE.name,
      SAMPLE_BASE_CASE.description,
      region,
      SAMPLE_BASE_CASE.referenceFlow,
      SAMPLE_BASE_CASE.referenceFlowUnit,
      SAMPLE_BASE_CASE.referenceFlow,
    ],
  )

  // The tree, parents first (the definition is in that order).
  const ids = new Map<string, number>()
  for (const step of SAMPLE_STEPS) {
    const parentId = step.parent ? ids.get(step.parent) : null
    if (step.parent && parentId == null) throw new Error(`sample: ${step.name} comes before its parent`)
    const id = await insertId(
      conn,
      `INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level,
                              quantity, unit, description, life_cycle_stage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        baseCaseId,
        parentId ?? null,
        step.name,
        step.tier,
        TIER_LEVEL[step.tier],
        step.quantity ?? 1,
        step.unit ?? 'unit',
        step.description ?? null,
        step.stage ?? null,
      ],
    )
    ids.set(step.name, id)

    for (const f of step.flows ?? []) {
      await conn.query(
        `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [id, substanceIds.get(f.substance), f.direction, f.quantity, f.unit, f.note.slice(0, 255)],
      )
    }

    for (const c of step.costs ?? []) {
      const amount = sampleCostAmount(c)
      const sets: Array<[string, unknown]> = [[COST_COLUMN[c.kind], amount]]
      if (c.kind === 'labor' && c.source === 'reference') {
        sets.push(['labor_hours', c.driver], ['labor_occupation', c.rateCode ?? null])
      }
      await conn.query(`UPDATE component SET ${sets.map(([col]) => `${col} = ?`).join(', ')} WHERE component_id = ?`, [
        ...sets.map(([, v]) => v),
        id,
      ])
      await conn.query(
        `INSERT INTO component_cost_basis
           (component_id, cost_kind, driver_quantity, driver_unit, rate, rate_unit, rate_label, rate_code,
            region, source_kind, source_name, vintage, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        c.source === 'reference'
          ? [id, c.kind, c.driver, c.driverUnit, c.rate, c.rateUnit, c.rateLabel, c.rateCode ?? null, 'US', 'reference', 'Reference', SAMPLE_REFERENCE_VINTAGE]
          : [id, c.kind, null, null, null, null, c.label, null, null, 'entered', c.label, null],
      )
    }
  }

  const goalScopeOf = async (caseId: number) => {
    const [project] = await rows(conn, `SELECT * FROM project WHERE project_id = ?`, [projectId])
    const [caseRow] = await rows(conn, `SELECT * FROM case_table WHERE case_id = ?`, [caseId])
    return buildGoalScope(project, caseRow)
  }

  const baseRun = await runCaseInTransaction(conn, {
    caseId: baseCaseId,
    caseName: SAMPLE_BASE_CASE.name,
    runName: 'Sample study',
    method,
    regionCode: region,
    userId,
    goalScope: await goalScopeOf(baseCaseId),
    quiet: true,
  })

  // The what-if: a copy of the base case with one change, run again.
  const whatIfCaseId = await insertId(
    conn,
    `INSERT INTO case_table (project_id, created_by, parent_case_id, case_name, case_type, description, region_code)
     VALUES (?, ?, ?, ?, 'comparative', ?, ?)`,
    [projectId, userId, baseCaseId, SAMPLE_WHAT_IF.name, SAMPLE_WHAT_IF.description, region],
  )
  const [baseRow] = await rows(conn, `SELECT * FROM case_table WHERE case_id = ?`, [baseCaseId])
  await copyCaseReferenceFields(conn, baseRow, whatIfCaseId)
  await copyCaseInventory(conn, baseCaseId, whatIfCaseId)
  const changed = (
    (
      await conn.query(
        `UPDATE flows f
            SET quantity = ?
           FROM component c, substances s
          WHERE c.component_id = f.component_id AND s.substance_id = f.substance_id
            AND c.case_id = ? AND c.component_name = ? AND s.substance_id = ? AND f.quantity = ?`,
        [SAMPLE_WHAT_IF.to, whatIfCaseId, SAMPLE_WHAT_IF.step, substanceIds.get(SAMPLE_WHAT_IF.substance), SAMPLE_WHAT_IF.from],
      )
    )[0] as any
  ).affectedRows
  if (Number(changed) !== 1) throw new Error(`sample: the what-if changed ${changed} flows, expected 1`)

  const whatIfRun = await runCaseInTransaction(conn, {
    caseId: whatIfCaseId,
    caseName: SAMPLE_WHAT_IF.name,
    runName: SAMPLE_WHAT_IF.name,
    method,
    regionCode: region,
    userId,
    goalScope: await goalScopeOf(whatIfCaseId),
    quiet: true,
  })

  return { projectId, baseCaseId, whatIfCaseId, baseRunId: baseRun.runId, whatIfRunId: whatIfRun.runId }
}
