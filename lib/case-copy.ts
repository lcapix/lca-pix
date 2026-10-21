/**
 * Deep copy of a case's inventory, shared by POST /api/cases/[id]/duplicate
 * and POST /api/cases/[id]/clone-from. Runs on the caller's connection so the
 * whole copy is one transaction.
 *
 * Copies every step (costs, labor multiplicands, allocation, life-cycle stage)
 * in parent-before-child order from the real parent links, re-deriving each
 * step's depth, then every flow (with its transport leg). Columns that a later
 * migration added are copied only where the source row has them: SELECT *
 * shows which exist, so an older database never sees an unknown column.
 * Column names come from the fixed lists below, never from a request.
 */

import { parentFirstOrder, MAX_DEPTH } from '@/lib/component-tree'

type Conn = { query: (sql: string, params?: unknown[]) => Promise<any> }

/** Component columns copied as-is when present on the source row. */
const COMPONENT_COLUMNS = [
  'component_name',
  'component_type',
  'quantity',
  'unit',
  'description',
  'process_type',
  'driver_category',
  'driver_type',
  'opex',
  'capex',
  'labor_cost',
  'labor_hours',
  'labor_occupation',
  'energy_cost',
  'transportation_cost',
  'material_cost',
  'equipment_cost',
  'overhead_cost',
  'currency',
  'cost_allocation_type',
  'allocation_method',
  'allocation_factor',
  'allocation_note',
  'life_cycle_stage',
]

const FLOW_COLUMNS = [
  'substance_id',
  'flow_type',
  'quantity',
  'unit',
  'is_driver',
  'driver_description',
  'transport_mass_kg',
  'transport_distance_km',
  'transport_mode',
]

/** component_cost_basis columns copied with a step (migrate-035). */
const COST_BASIS_COLUMNS = [
  'cost_kind',
  'driver_quantity',
  'driver_unit',
  'rate',
  'rate_unit',
  'rate_label',
  'rate_code',
  'region',
  'source_kind',
  'source_name',
  'vintage',
  'updated_by',
]

/** flow_factor_overrides columns copied with a flow (migrate-034). */
const OVERRIDE_COLUMNS = [
  'category_id',
  'factor_value',
  'impact_unit',
  'per_unit',
  'source',
  'note',
  'created_by',
]

const CASE_REFERENCE_COLUMNS = ['reference_flow', 'reference_flow_unit', 'modeled_output']

const present = (row: Record<string, unknown>, cols: string[]) =>
  cols.filter((c) => Object.prototype.hasOwnProperty.call(row, c))

/** A JSON column comes back parsed from mysql2; it must go back in as text (CMP-1). */
function jsonText(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  return typeof v === 'string' ? v : JSON.stringify(v)
}

async function insertRow(conn: Conn, table: string, values: Array<[string, unknown]>) {
  const [res] = await conn.query(
    `INSERT INTO ${table} (${values.map(([c]) => c).join(', ')}) VALUES (${values
      .map(() => '?')
      .join(', ')})`,
    values.map(([, v]) => v),
  )
  return Number(res.insertId)
}

/** Reference flow, its unit and the data basis of this alternative (migrate-014). */
export async function copyCaseReferenceFields(
  conn: Conn,
  sourceCase: Record<string, unknown>,
  targetCaseId: number,
): Promise<void> {
  const cols = present(sourceCase, CASE_REFERENCE_COLUMNS)
  if (!cols.length) return
  await conn.query(
    `UPDATE case_table SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE case_id = ?`,
    [...cols.map((c) => sourceCase[c] ?? null), targetCaseId],
  )
}

export async function copyCaseInventory(
  conn: Conn,
  sourceCaseId: number,
  targetCaseId: number,
): Promise<{ components: number; flows: number }> {
  const [components]: [any[]] = await conn.query(
    `SELECT * FROM component WHERE case_id = ? ORDER BY component_id`,
    [sourceCaseId],
  )

  const idMap = new Map<number, number>()
  const depth = new Map<number, number>()
  for (const comp of parentFirstOrder(components)) {
    const oldParent = comp.parent_component_id == null ? null : Number(comp.parent_component_id)
    const newParent = oldParent != null ? idMap.get(oldParent) ?? null : null
    const level =
      newParent != null ? Math.min(MAX_DEPTH, (depth.get(oldParent!) ?? 1) + 1) : 1
    const newId = await insertRow(conn, 'component', [
      ['case_id', targetCaseId],
      ['parent_component_id', newParent],
      ['hierarchy_level', level],
      ['drivers', jsonText(comp.drivers)],
      ...present(comp, COMPONENT_COLUMNS).map((c) => [c, comp[c] ?? null] as [string, unknown]),
    ])
    idMap.set(Number(comp.component_id), newId)
    depth.set(Number(comp.component_id), level)
  }
  await copyCostBasis(conn, idMap)

  let flowsCopied = 0
  const oldIds = [...idMap.keys()]
  if (oldIds.length) {
    const [flows]: [any[]] = await conn.query(
      `SELECT * FROM flows WHERE component_id IN (${oldIds.map(() => '?').join(', ')}) ORDER BY flow_id`,
      oldIds,
    )
    const flowIdMap = new Map<number, number>()
    for (const flow of flows) {
      const newFlowId = await insertRow(conn, 'flows', [
        ['component_id', idMap.get(Number(flow.component_id))],
        ...present(flow, FLOW_COLUMNS).map((c) => [c, flow[c] ?? null] as [string, unknown]),
      ])
      flowIdMap.set(Number(flow.flow_id), newFlowId)
      flowsCopied++
    }
    await copyFactorOverrides(conn, flowIdMap)
  }

  return { components: idMap.size, flows: flowsCopied }
}

/**
 * A copy keeps how each cost was built (migrate-035), on the new step ids.
 * Nothing to do on a database without the table.
 */
async function copyCostBasis(conn: Conn, idMap: Map<number, number>): Promise<void> {
  const oldIds = [...idMap.keys()]
  if (!oldIds.length) return
  let rows: any[]
  try {
    ;[rows] = await conn.query(
      `SELECT * FROM component_cost_basis WHERE component_id IN (${oldIds.map(() => '?').join(', ')})`,
      oldIds,
    )
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return
    throw err
  }
  for (const r of Array.isArray(rows) ? rows : []) {
    await insertRow(conn, 'component_cost_basis', [
      ['component_id', idMap.get(Number(r.component_id))],
      ['cost_lines', jsonText(r.cost_lines)],
      ...COST_BASIS_COLUMNS.map((c) => [c, r[c] ?? null] as [string, unknown]),
    ])
  }
}

/**
 * A copy keeps every number the source used, the person's own factors
 * included (migrate-034). Who entered one stays with it. Nothing to do on a
 * database without the table.
 */
async function copyFactorOverrides(conn: Conn, flowIdMap: Map<number, number>): Promise<void> {
  const oldFlowIds = [...flowIdMap.keys()]
  if (!oldFlowIds.length) return
  let overrides: any[]
  try {
    ;[overrides] = await conn.query(
      `SELECT * FROM flow_factor_overrides WHERE flow_id IN (${oldFlowIds.map(() => '?').join(', ')}) ORDER BY override_id`,
      oldFlowIds,
    )
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return
    throw err
  }
  for (const o of Array.isArray(overrides) ? overrides : []) {
    await insertRow(conn, 'flow_factor_overrides', [
      ['flow_id', flowIdMap.get(Number(o.flow_id))],
      ...OVERRIDE_COLUMNS.map((c) => [c, o[c] ?? null] as [string, unknown]),
    ])
  }
}
