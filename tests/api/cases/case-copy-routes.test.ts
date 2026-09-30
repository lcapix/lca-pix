import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as duplicate } from '@/app/api/cases/[caseId]/duplicate/route'
import { POST as cloneFrom } from '@/app/api/cases/[caseId]/clone-from/route'
import * as auth from '@/lib/auth'
import * as db from '@/lib/db-helpers'

vi.mock('@/lib/auth')
vi.mock('@/lib/db-helpers')

const SOURCE_COMPONENTS = [
  { component_id: 1, case_id: 5, parent_component_id: null, component_name: 'Bracket', component_type: 'product', hierarchy_level: 1, drivers: null, life_cycle_stage: null },
  { component_id: 2, case_id: 5, parent_component_id: 1, component_name: 'Cut', component_type: 'operation', hierarchy_level: 2, drivers: ['Steel (kg)', 'Electricity (kWh)'], labor_cost: '3.00', life_cycle_stage: 'materials' },
]
const SOURCE_FLOWS = [
  { flow_id: 11, component_id: 2, substance_id: 4, flow_type: 'input', quantity: '2.000000', unit: 'kg', is_driver: 1, driver_description: null },
  { flow_id: 12, component_id: 2, substance_id: 6, flow_type: 'input', quantity: '382.500000', unit: 'tkm', is_driver: 1, driver_description: null, transport_mass_kg: '850.000000', transport_distance_km: '450.000', transport_mode: null },
]

function setup(opts: { targetCount?: number } = {}) {
  vi.mocked(auth.requireAuth).mockResolvedValue(42)
  vi.mocked(auth.checkProjectAccess).mockResolvedValue(true)
  vi.mocked(db.queryOne).mockImplementation(async (sql: string, params?: any[]) => {
    if (/COUNT\(\*\)/i.test(sql)) return { n: Number(params?.[0]) === 5 ? 2 : opts.targetCount ?? 0 } as any
    if (/FROM case_table WHERE case_id/i.test(sql)) {
      return {
        case_id: Number(params?.[0]),
        project_id: 7,
        case_name: Number(params?.[0]) === 5 ? 'Base' : 'Alt',
        description: null,
        region_code: null,
        reference_flow: '2.000000',
        reference_flow_unit: 'bracket',
        modeled_output: '4.000000',
      } as any
    }
    return null
  })
  vi.mocked(db.query).mockImplementation(async (sql: string, params?: any[]) => {
    if (/COUNT\(\*\)/i.test(sql)) return [{ n: opts.targetCount ?? 0 }] as any
    return [] as any
  })
  vi.mocked(db.insert).mockRejectedValue(new Error('pool insert used outside the transaction'))
  const calls: Array<{ sql: string; params: any[] }> = []
  let next = 500
  const conn = {
    calls,
    query: vi.fn(async (sql: string, params: any[] = []) => {
      calls.push({ sql, params })
      if (/SELECT \* FROM component WHERE case_id/i.test(sql)) return [SOURCE_COMPONENTS]
      if (/SELECT \* FROM flows WHERE component_id IN/i.test(sql)) return [SOURCE_FLOWS.filter((f) => params.includes(f.component_id))]
      if (/^\s*INSERT/i.test(sql)) return [{ insertId: next++, affectedRows: 1 }]
      return [{ affectedRows: 1 }]
    }),
  }
  vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn))
  return conn
}

const req = (url: string, body: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any

beforeEach(() => vi.resetAllMocks())

describe('POST /api/cases/:id/duplicate', () => {
  it('duplicates a case whose steps have parsed JSON drivers (CMP-1 used to 500)', async () => {
    const conn = setup()
    const res = await duplicate(req('http://t/api/cases/5/duplicate', { case_name: 'Alt' }), {
      params: Promise.resolve({ caseId: '5' }),
    } as any)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ components_copied: 2, flows_copied: 2 })
    const cut = conn.calls.find((c) => /INSERT INTO component/i.test(c.sql) && c.params.includes('Cut'))!
    expect(cut.params).toContain('["Steel (kg)","Electricity (kWh)"]')
    expect(cut.params).toContain('materials') // CMP-3: stage copied
    const leg = conn.calls.find((c) => /INSERT INTO flows/i.test(c.sql) && c.params.includes('tkm'))!
    expect(leg.sql).toMatch(/transport_mass_kg/) // CMP-3: transport leg copied
  })
})

describe('POST /api/cases/:id/clone-from (CMP-2)', () => {
  it('deep-copies steps, flows and the reference flow inside one transaction', async () => {
    const conn = setup()
    const res = await cloneFrom(req('http://t/api/cases/9/clone-from', { sourceCaseId: 5 }), {
      params: Promise.resolve({ caseId: '9' }),
    } as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, cloned: 2, flows_copied: 2 })
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(db.insert).not.toHaveBeenCalled()
    expect(conn.calls.filter((c) => /INSERT INTO flows/i.test(c.sql))).toHaveLength(2)
    const ref = conn.calls.find((c) => /UPDATE case_table/i.test(c.sql))!
    expect(ref.params).toEqual(['2.000000', 'bracket', '4.000000', 9])
    expect(conn.calls.every((c) => !/INSERT INTO component/i.test(c.sql) || c.params.includes(9))).toBe(true)
  })

  it('still refuses a target case that already has steps', async () => {
    const conn = setup({ targetCount: 3 })
    const res = await cloneFrom(req('http://t/api/cases/9/clone-from', { sourceCaseId: 5 }), {
      params: Promise.resolve({ caseId: '9' }),
    } as any)
    expect(res.status).toBe(409)
    expect(conn.calls).toHaveLength(0)
  })
})
