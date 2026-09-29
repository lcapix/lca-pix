import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/cases/[caseId]/components/route'
import * as auth from '@/lib/auth'
import * as db from '@/lib/db-helpers'

vi.mock('@/lib/auth')
vi.mock('@/lib/db-helpers')

// Case 10: 1 product ── 2 line ── 3 op
const CASE_ROWS = [
  { component_id: 1, parent_component_id: null, hierarchy_level: 1 },
  { component_id: 2, parent_component_id: 1, hierarchy_level: 2 },
  { component_id: 3, parent_component_id: 2, hierarchy_level: 3 },
]

function setup() {
  vi.mocked(auth.requireAuth).mockResolvedValue(42)
  vi.mocked(auth.checkProjectAccess).mockResolvedValue(true)
  vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
    if (/FROM case_table/.test(sql)) return { project_id: 7 } as any
    if (/c\.\*/.test(sql)) return { component_id: 99, component_name: 'New' } as any
    return null
  })
  vi.mocked(db.query).mockImplementation(async (sql: string) => {
    if (/FROM component\s+WHERE case_id/i.test(sql)) return CASE_ROWS as any
    return [] as any
  })
  vi.mocked(db.insert).mockResolvedValue(99)
  vi.mocked(db.execute).mockResolvedValue(1)
}

function post(body: unknown) {
  return POST(
    new Request('http://t/api/cases/10/components', {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any,
    { params: Promise.resolve({ caseId: '10' }) } as any,
  )
}

beforeEach(() => vi.resetAllMocks())

describe('POST /api/cases/:caseId/components', () => {
  it('rejects a parent from another case (M1) and inserts nothing', async () => {
    setup()
    const res = await post({ component_name: 'Weld', component_type: 'operation', parent_component_id: 555 })
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('sets hierarchy_level to the parent depth + 1', async () => {
    setup()
    const res = await post({ component_name: 'Weld', component_type: 'elemental_task', parent_component_id: 3 })
    expect(res.status).toBe(201)
    const [, params] = vi.mocked(db.insert).mock.calls[0]
    // (case_id, parent, name, type, level, ...)
    expect(params![1]).toBe(3)
    expect(params![4]).toBe(4)
  })

  it('rejects an unknown life-cycle stage (EDIT-2)', async () => {
    setup()
    const res = await post({ component_name: 'Ship', component_type: 'operation', parent_component_id: 1, life_cycle_stage: 'shipping' })
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('saves the cost breakdown sent with a new step, including 0 (FLOW-7)', async () => {
    setup()
    const res = await post({
      component_name: 'Paint',
      component_type: 'operation',
      parent_component_id: 1,
      labor_cost: 0,
      material_cost: 12.5,
    })
    expect(res.status).toBe(201)
    const w = vi.mocked(db.execute).mock.calls.find(([s]) => /labor_cost\s*=\s*\?/.test(s))
    expect(w).toBeTruthy()
    const sql = w![0]
    const params = w![1]!
    const cols = [...sql.matchAll(/(\w+) = \?/g)].map((m) => m[1])
    expect(params[cols.indexOf('labor_cost')]).toBe(0)
    expect(params[cols.indexOf('material_cost')]).toBe(12.5)
  })
})
