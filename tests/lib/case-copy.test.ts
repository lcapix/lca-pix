import { describe, it, expect } from 'vitest'
import { copyCaseInventory, copyCaseReferenceFields } from '@/lib/case-copy'

type Call = { sql: string; params: any[] }

/** A fake mysql2 connection: SELECTs answer from fixtures, INSERTs hand out ids. */
function fakeConn(components: any[], flows: any[]) {
  const calls: Call[] = []
  let nextId = 1000
  const conn = {
    calls,
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params })
      if (/SELECT \* FROM component WHERE case_id/i.test(sql)) return [components]
      if (/SELECT \* FROM flows WHERE component_id IN/i.test(sql)) {
        return [flows.filter((f) => params.includes(f.component_id))]
      }
      if (/^\s*INSERT/i.test(sql)) return [{ insertId: nextId++, affectedRows: 1 }]
      return [{ affectedRows: 1 }]
    },
  }
  return conn
}

const inserts = (conn: ReturnType<typeof fakeConn>, table: string) =>
  conn.calls
    .filter((c) => new RegExp(`INSERT INTO ${table}\\b`, 'i').test(c.sql))
    .map((c) => {
      const cols = /\(([^)]*)\)\s*VALUES/i.exec(c.sql)![1].split(',').map((s) => s.trim())
      return Object.fromEntries(cols.map((col, i) => [col, c.params[i]]))
    })

const product = {
  component_id: 1,
  case_id: 5,
  parent_component_id: null,
  component_name: 'Bracket',
  component_type: 'product',
  hierarchy_level: 1,
  quantity: '1.000000',
  unit: 'unit',
  drivers: null,
}
// Re-parented before EDIT-9 was fixed: stored level 1, really depth 3.
const moved = {
  component_id: 3,
  case_id: 5,
  parent_component_id: 2,
  component_name: 'Weld',
  component_type: 'operation',
  hierarchy_level: 1,
  quantity: '1.000000',
  unit: 'unit',
  // mysql2 hands JSON columns back already parsed (CMP-1).
  drivers: ['Electricity (kWh)', 'Steel (kg)'],
  labor_cost: '0.00',
  labor_hours: '0.2500',
  labor_occupation: '51-4121',
  energy_cost: '4.10',
  material_cost: null,
  currency: 'USD',
  cost_allocation_type: 'manual',
  allocation_method: 'economic',
  allocation_factor: '0.800000',
  allocation_note: 'by value',
  life_cycle_stage: 'materials',
}
const line = {
  component_id: 2,
  case_id: 5,
  parent_component_id: 1,
  component_name: 'Line',
  component_type: 'machine_line',
  hierarchy_level: 2,
  quantity: '1.000000',
  unit: 'unit',
  drivers: '["Machine Hours (h)"]',
}
const flows = [
  {
    flow_id: 70,
    component_id: 3,
    substance_id: 9,
    flow_type: 'input',
    quantity: '382.500000',
    unit: 'tkm',
    is_driver: 1,
    driver_description: 'leg',
    transport_mass_kg: '850.000000',
    transport_distance_km: '450.000',
    transport_mode: 'truck',
  },
]

describe('copyCaseInventory (CMP-1 / CMP-2 / CMP-3)', () => {
  it('inserts parents before children and remaps parent ids, even with stale levels', async () => {
    const conn = fakeConn([moved, product, line], flows)
    await copyCaseInventory(conn as any, 5, 8)
    const rows = inserts(conn, 'component')
    expect(rows.map((r) => r.component_name)).toEqual(['Bracket', 'Line', 'Weld'])
    // ids handed out 1000, 1001, 1002 in that order
    expect(rows[0].parent_component_id).toBeNull()
    expect(rows[1].parent_component_id).toBe(1000)
    expect(rows[2].parent_component_id).toBe(1001)
    // Depth, recomputed from the real tree.
    expect(rows.map((r) => r.hierarchy_level)).toEqual([1, 2, 3])
    expect(rows.every((r) => r.case_id === 8)).toBe(true)
  })

  it('stringifies drivers that mysql2 already parsed', async () => {
    const conn = fakeConn([product, line, moved], flows)
    await copyCaseInventory(conn as any, 5, 8)
    const weld = inserts(conn, 'component').find((r) => r.component_name === 'Weld')!
    expect(weld.drivers).toBe('["Electricity (kWh)","Steel (kg)"]')
    const lineRow = inserts(conn, 'component').find((r) => r.component_name === 'Line')!
    expect(lineRow.drivers).toBe('["Machine Hours (h)"]')
  })

  it('copies costs, labor, allocation and the life-cycle stage', async () => {
    const conn = fakeConn([product, line, moved], flows)
    await copyCaseInventory(conn as any, 5, 8)
    const weld = inserts(conn, 'component').find((r) => r.component_name === 'Weld')!
    expect(weld).toMatchObject({
      labor_cost: '0.00',
      labor_hours: '0.2500',
      labor_occupation: '51-4121',
      energy_cost: '4.10',
      allocation_method: 'economic',
      allocation_factor: '0.800000',
      allocation_note: 'by value',
      life_cycle_stage: 'materials',
    })
  })

  it('copies every flow, with its transport leg, onto the new step', async () => {
    const conn = fakeConn([product, line, moved], flows)
    const result = await copyCaseInventory(conn as any, 5, 8)
    const f = inserts(conn, 'flows')
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({
      component_id: 1002,
      substance_id: 9,
      flow_type: 'input',
      quantity: '382.500000',
      unit: 'tkm',
      transport_mass_kg: '850.000000',
      transport_distance_km: '450.000',
      transport_mode: 'truck',
    })
    expect(f[0].flow_id).toBeUndefined()
    expect(result).toEqual({ components: 3, flows: 1 })
  })
})

describe('copyCaseReferenceFields', () => {
  it('copies the reference flow and data basis that exist on the source row', async () => {
    const conn = fakeConn([], [])
    await copyCaseReferenceFields(
      conn as any,
      { reference_flow: '2.000000', reference_flow_unit: 'bracket', modeled_output: '4.000000' },
      8,
    )
    const u = conn.calls.find((c) => /UPDATE case_table/i.test(c.sql))!
    expect(u.params).toEqual(['2.000000', 'bracket', '4.000000', 8])
  })
})
