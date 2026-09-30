import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/example-project/route'
import * as auth from '@/lib/auth'
import * as db from '@/lib/db-helpers'
import { EXAMPLE_CASE, EXAMPLE_PROJECT } from '@/lib/example-case'

vi.mock('@/lib/auth')
vi.mock('@/lib/db-helpers')

type Call = { sql: string; params: any[] }

function setup(opts: { failOn?: RegExp } = {}) {
  vi.mocked(auth.requireAuth).mockResolvedValue(42)
  vi.mocked(db.queryOne).mockResolvedValue(null) // no example yet
  vi.mocked(db.insert).mockRejectedValue(new Error('pool write outside the transaction'))
  vi.mocked(db.execute).mockRejectedValue(new Error('pool write outside the transaction'))
  const calls: Call[] = []
  let next = 100
  const conn = {
    query: vi.fn(async (sql: string, params: any[] = []) => {
      calls.push({ sql, params })
      if (opts.failOn?.test(sql)) throw Object.assign(new Error('disk full'), { code: 'ER_DISK_FULL' })
      if (/FROM permissions/i.test(sql)) return [[{ permission_id: 1 }]]
      if (/FROM substances/i.test(sql)) return [[{ substance_id: 3 }]]
      if (/^\s*INSERT/i.test(sql)) return [{ insertId: next++, affectedRows: 1 }]
      return [{ affectedRows: 1 }]
    }),
  }
  vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn))
  return calls
}

const call = () =>
  POST(new Request('http://t/api/example-project', { method: 'POST', headers: { Authorization: 'Bearer x' } }) as any)

beforeEach(() => vi.resetAllMocks())

describe('POST /api/example-project (PROJ-1 / PROJ-2)', () => {
  it('writes the functional unit and boundary to the project', async () => {
    const calls = setup()
    const res = await call()
    expect(res.status).toBe(200)
    const u = calls.find((c) => /UPDATE project\b/i.test(c.sql) && /functional_unit/.test(c.sql))
    expect(u).toBeTruthy()
    expect(u!.params).toContain(EXAMPLE_CASE.functionalUnit)
    expect(u!.params).toContain(EXAMPLE_CASE.boundary)
  })

  it('writes the reference flow and data basis to the case, and nothing that lives on the project', async () => {
    const calls = setup()
    await call()
    const u = calls.find((c) => /UPDATE case_table/i.test(c.sql))!
    expect(u.sql).toMatch(/reference_flow\s*=/)
    expect(u.sql).toMatch(/reference_flow_unit\s*=/)
    expect(u.sql).toMatch(/modeled_output\s*=/)
    expect(u.sql).not.toMatch(/functional_unit|system_boundary/)
    expect(u.params).toContain(EXAMPLE_CASE.referenceFlowUnit)
  })

  it('adds the owner membership row every other project gets', async () => {
    const calls = setup()
    await call()
    const m = calls.find((c) => /INSERT INTO project_members/i.test(c.sql))
    expect(m).toBeTruthy()
    expect(m!.params).toEqual([100, 42, 1])
  })

  it('builds everything inside one transaction and fails whole (500) on a real error', async () => {
    const calls = setup({ failOn: /INSERT INTO flows/i })
    const res = await call()
    expect(res.status).toBe(500)
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.execute).not.toHaveBeenCalled()
    expect(calls.some((c) => /INSERT INTO project\b/i.test(c.sql) && c.params.includes(EXAMPLE_PROJECT.name))).toBe(true)
  })
})
