import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/components/[componentId]/flows/route'
import { PUT } from '@/app/api/flows/[flowId]/route'
import * as auth from '@/lib/auth'
import * as db from '@/lib/db-helpers'

vi.mock('@/lib/auth')
vi.mock('@/lib/db-helpers')

const USER = 42

// Substance 1: library. 2: USER's own custom. 3: someone else's custom.
const SUBSTANCES: Record<number, any> = {
  1: { substance_id: 1, substance_name: 'Steel', default_unit: 'kg', is_custom: 0, created_by: null },
  2: { substance_id: 2, substance_name: 'My cork', default_unit: 'kg', is_custom: 1, created_by: USER },
  3: { substance_id: 3, substance_name: 'Rival secret alloy', default_unit: 'kg', is_custom: 1, created_by: 77 },
}

function setup() {
  vi.mocked(auth.requireAuth).mockResolvedValue(USER)
  vi.mocked(auth.checkProjectAccess).mockResolvedValue(true)
  vi.mocked(db.queryOne).mockImplementation(async (sql: string, params?: any[]) => {
    if (/FROM substances/i.test(sql)) {
      const s = SUBSTANCES[Number(params?.[0])]
      if (!s) return null
      // Honour a visibility filter when the route asks for one.
      if (/is_custom\s*=\s*0\s+OR\s+created_by\s*=\s*\?/i.test(sql)) {
        const caller = Number(params?.[1])
        return s.is_custom === 0 || s.created_by === caller ? s : null
      }
      return s
    }
    if (/FROM flows f\s+LEFT JOIN substances/i.test(sql)) return { flow_id: 5, substance_name: 'x' } as any
    if (/SELECT substance_id FROM flows/i.test(sql)) return { substance_id: 1 } as any
    if (/FROM flows f/i.test(sql) || /FROM component c/i.test(sql)) return { project_id: 7 } as any
    return null
  })
  vi.mocked(db.insert).mockResolvedValue(5)
  vi.mocked(db.execute).mockResolvedValue(1)
}

const post = (body: unknown) =>
  POST(
    new Request('http://t/api/components/9/flows', {
      method: 'POST',
      headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any,
    { params: Promise.resolve({ componentId: '9' }) } as any,
  )

const put = (body: unknown) =>
  PUT(
    new Request('http://t/api/flows/5', {
      method: 'PUT',
      headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any,
    { params: Promise.resolve({ flowId: '5' }) } as any,
  )

const base = { substance_id: 1, flow_type: 'input', unit: 'kg' }

beforeEach(() => vi.resetAllMocks())

describe('POST /api/components/:id/flows — quantity (FLOW-4)', () => {
  it.each([
    ['null', null],
    ['a word', 'abc'],
    ['an empty string', ''],
    ['a negative number', -2],
    ['Infinity as a string', 'Infinity'],
  ])('rejects %s with 400 and inserts nothing', async (_label, quantity) => {
    setup()
    const res = await post({ ...base, quantity })
    expect(res.status).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('accepts 0 and positive numbers', async () => {
    setup()
    expect((await post({ ...base, quantity: 0 })).status).toBe(201)
    expect((await post({ ...base, quantity: '2.5' })).status).toBe(201)
    const quantities = vi.mocked(db.insert).mock.calls.map(([, p]) => p![3])
    expect(quantities).toEqual([0, 2.5])
  })
})

describe('POST /api/components/:id/flows — substance visibility (L3)', () => {
  it('accepts a library substance and the caller’s own custom substance', async () => {
    setup()
    expect((await post({ ...base, quantity: 1, substance_id: 1 })).status).toBe(201)
    expect((await post({ ...base, quantity: 1, substance_id: 2 })).status).toBe(201)
  })

  it('rejects another user’s private substance without echoing its name', async () => {
    setup()
    const res = await post({ ...base, quantity: 1, substance_id: 3 })
    expect(res.status).toBe(400)
    expect(JSON.stringify(await res.json())).not.toMatch(/Rival/)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('PUT /api/flows/:id', () => {
  it('rejects a non-finite or negative quantity (FLOW-4)', async () => {
    setup()
    expect((await put({ quantity: 'abc' })).status).toBe(400)
    expect((await put({ quantity: -1 })).status).toBe(400)
    expect((await put({ quantity: null })).status).toBe(400)
    expect(db.execute).not.toHaveBeenCalled()
  })

  it('rejects swapping to another user’s private substance (L3)', async () => {
    setup()
    const res = await put({ substance_id: 3 })
    expect(res.status).toBe(400)
    expect(JSON.stringify(await res.json())).not.toMatch(/Rival/)
    expect(db.execute).not.toHaveBeenCalled()
  })

  it('allows swapping to the caller’s own custom substance', async () => {
    setup()
    const res = await put({ substance_id: 2 })
    expect(res.status).toBe(200)
  })

  it('a hand-edited quantity drops the transport leg it no longer matches (TKM-2)', async () => {
    setup()
    const res = await put({ quantity: 12 })
    expect(res.status).toBe(200)
    const leg = vi.mocked(db.execute).mock.calls.find(([s]) => /transport_mass_kg/.test(s))
    expect(leg).toBeTruthy()
    expect(leg![0]).toMatch(/transport_mass_kg\s*=\s*NULL/i)
  })
})

describe('PUT /api/flows/:id — unit guard on a swap without a unit (FLOW-10)', () => {
  it('checks the flow’s current unit against the new substance', async () => {
    setup()
    const queryOne = vi.mocked(db.queryOne).getMockImplementation()!
    vi.mocked(db.queryOne).mockImplementation(async (sql: string, params?: any[]) => {
      if (/SELECT unit FROM flows/i.test(sql)) return { unit: 'kWh' } as any
      return queryOne(sql, params)
    })
    const res = await put({ substance_id: 2 }) // kg-based; the flow is in kWh
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/kWh/)
    expect(db.execute).not.toHaveBeenCalled()
  })
})
