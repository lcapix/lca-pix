import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PUT, DELETE } from '@/app/api/components/[componentId]/route'
import * as auth from '@/lib/auth'
import * as db from '@/lib/db-helpers'

vi.mock('@/lib/auth')
vi.mock('@/lib/db-helpers')

// Case 10's tree:
// 1 product ─┬─ 2 line ── 3 op ── 4 task
//            └─ 5 op
const CASE_ROWS = [
  { component_id: 1, parent_component_id: null, hierarchy_level: 1 },
  { component_id: 2, parent_component_id: 1, hierarchy_level: 2 },
  { component_id: 3, parent_component_id: 2, hierarchy_level: 3 },
  { component_id: 4, parent_component_id: 3, hierarchy_level: 4 },
  { component_id: 5, parent_component_id: 1, hierarchy_level: 2 },
]

type Conn = { query: ReturnType<typeof vi.fn> }

function fakeDb(id: number, opts: { type?: string } = {}): Conn {
  const self = CASE_ROWS.find((r) => r.component_id === id)!
  vi.mocked(auth.requireAuth).mockResolvedValue(42)
  vi.mocked(auth.checkProjectAccess).mockResolvedValue(true)
  vi.mocked(db.queryOne).mockImplementation(async (sql: string) => {
    if (/c\.\*/.test(sql)) return { component_id: id, component_name: 'x' } as any
    if (/FROM component c/.test(sql)) {
      return {
        case_id: 10,
        project_id: 7,
        component_type: opts.type ?? 'operation',
        parent_component_id: self.parent_component_id,
        hierarchy_level: self.hierarchy_level,
      } as any
    }
    return null
  })
  vi.mocked(db.query).mockImplementation(async (sql: string) => {
    if (/FROM component\s+WHERE case_id/i.test(sql)) return CASE_ROWS as any
    return [] as any
  })
  vi.mocked(db.execute).mockResolvedValue(1)
  const conn: Conn = { query: vi.fn(async () => [{ affectedRows: 1 }]) }
  vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn))
  return conn
}

function put(id: number, body: unknown) {
  return PUT(
    new Request(`http://t/api/components/${id}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as any,
    { params: Promise.resolve({ componentId: String(id) }) } as any,
  )
}

function del(id: number, children?: string) {
  const q = children ? `?children=${children}` : ''
  return DELETE(
    new Request(`http://t/api/components/${id}${q}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer x' },
    }) as any,
    { params: Promise.resolve({ componentId: String(id) }) } as any,
  )
}

/** Every SQL statement the route wrote, in order, with its params. */
function writes(conn: Conn): Array<[string, unknown[]]> {
  const viaPool = vi.mocked(db.execute).mock.calls.map(([s, p]) => [s, p ?? []] as [string, unknown[]])
  const viaTx = conn.query.mock.calls.map(([s, p]: any) => [s, p ?? []] as [string, unknown[]])
  return [...viaTx, ...viaPool]
}

beforeEach(() => vi.resetAllMocks())

describe('PUT /api/components/:id — placement (M1 / FLOW-1 / EDIT-9)', () => {
  it('rejects a parent from another case, writes nothing and echoes no name', async () => {
    const conn = fakeDb(5)
    const res = await put(5, { parent_component_id: 999 })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.parent_component_name).toBeUndefined()
    expect(body.component).toBeUndefined()
    expect(writes(conn)).toHaveLength(0)
  })

  it('rejects a node as its own parent', async () => {
    const conn = fakeDb(3)
    const res = await put(3, { parent_component_id: 3 })
    expect(res.status).toBe(400)
    expect(writes(conn)).toHaveLength(0)
  })

  it('rejects a cycle (moving a node under its own descendant)', async () => {
    const conn = fakeDb(2)
    const res = await put(2, { parent_component_id: 4 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/loop/i)
    expect(writes(conn)).toHaveLength(0)
  })

  it('updates hierarchy_level of the moved node and its descendants', async () => {
    const conn = fakeDb(3)
    const res = await put(3, { parent_component_id: 1 })
    expect(res.status).toBe(200)
    // One `SET hierarchy_level = ? WHERE component_id = ?` per changed row.
    const levelOf = new Map<number, number>()
    for (const [s, p] of writes(conn)) {
      if (/SET hierarchy_level\s*=\s*\?\s+WHERE component_id\s*=\s*\?/.test(s)) {
        levelOf.set(Number(p[1]), Number(p[0]))
      }
    }
    expect(levelOf.get(3)).toBe(2)
    expect(levelOf.get(4)).toBe(3)
    // Unaffected rows are not touched (their updated_at feeds staleness checks).
    expect(levelOf.has(5)).toBe(false)
  })
})

describe('PUT /api/components/:id — life-cycle stage (EDIT-2)', () => {
  it('rejects a stage outside STAGE_IDS before writing anything', async () => {
    const conn = fakeDb(5)
    const res = await put(5, { life_cycle_stage: 'marketing' })
    expect(res.status).toBe(400)
    expect(writes(conn)).toHaveLength(0)
  })

  it('writes a valid stage', async () => {
    const conn = fakeDb(5)
    const res = await put(5, { life_cycle_stage: 'use' })
    expect(res.status).toBe(200)
    const w = writes(conn).find(([s]) => /life_cycle_stage\s*=/.test(s))
    expect(w?.[1]).toContain('use')
  })
})

describe('PUT /api/components/:id — costs (FLOW-2 / FLOW-3)', () => {
  it('clears a cost to NULL when the key is sent as null', async () => {
    const conn = fakeDb(5)
    const res = await put(5, { labor_cost: null, energy_cost: 0 })
    expect(res.status).toBe(200)
    const w = writes(conn).find(([s]) => /labor_cost\s*=\s*\?/.test(s))
    expect(w).toBeTruthy()
    expect(w![0]).not.toMatch(/COALESCE\(\?,\s*labor_cost\)/)
    const cols = w![0]
    const idx = cols.indexOf('labor_cost') < cols.indexOf('energy_cost') ? [0, 1] : [1, 0]
    expect(w![1][idx[0]]).toBeNull()
    expect(w![1][idx[1]]).toBe(0)
  })

  it('leaves costs alone when no cost key is sent', async () => {
    const conn = fakeDb(5)
    await put(5, { component_name: 'Renamed' })
    expect(writes(conn).some(([s]) => /labor_cost/.test(s))).toBe(false)
  })

  it('returns 500 (generic message) when the cost update fails for a real reason', async () => {
    fakeDb(5)
    vi.mocked(db.execute).mockImplementation(async (sql: string) => {
      if (/labor_cost/.test(sql)) {
        throw Object.assign(new Error("Data too long for column 'labor_occupation'"), {
          code: 'ER_DATA_TOO_LONG',
        })
      }
      return 1
    })
    const res = await put(5, { labor_cost: 12 })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toMatch(/Data too long/)
  })

  it('on ER_BAD_FIELD_ERROR retries with only the columns the table has', async () => {
    fakeDb(5)
    let first = true
    vi.mocked(db.execute).mockImplementation(async (sql: string) => {
      if (/equipment_cost/.test(sql) && first) {
        first = false
        throw Object.assign(new Error("Unknown column 'equipment_cost'"), { code: 'ER_BAD_FIELD_ERROR' })
      }
      return 1
    })
    vi.mocked(db.query).mockImplementation(async (sql: string) => {
      if (/SHOW COLUMNS/i.test(sql)) {
        return [{ Field: 'labor_cost' }, { Field: 'energy_cost' }] as any
      }
      if (/FROM component\s+WHERE case_id/i.test(sql)) return CASE_ROWS as any
      return [] as any
    })
    const res = await put(5, { labor_cost: 5, equipment_cost: 9 })
    expect(res.status).toBe(200)
    const retried = vi
      .mocked(db.execute)
      .mock.calls.map(([s]) => s)
      .filter((s) => /labor_cost/.test(s))
    expect(retried).toHaveLength(2)
    expect(retried[1]).not.toMatch(/equipment_cost/)
  })

  it('rejects a non-numeric or negative cost with 400 before writing', async () => {
    const conn = fakeDb(5)
    expect((await put(5, { material_cost: 'abc' })).status).toBe(400)
    expect((await put(5, { material_cost: -3 })).status).toBe(400)
    expect(writes(conn)).toHaveLength(0)
  })

  it('validates allocation before any other write (no partial update on 400)', async () => {
    const conn = fakeDb(5)
    const res = await put(5, { component_name: 'Renamed', allocation_factor: 7 })
    expect(res.status).toBe(400)
    expect(writes(conn)).toHaveLength(0)
  })
})

describe('DELETE /api/components/:id (EDIT-1 / FLOW-10)', () => {
  it('lets an editor delete (same level as create)', async () => {
    fakeDb(5)
    const res = await del(5)
    expect(res.status).toBe(200)
    expect(vi.mocked(auth.checkProjectAccess)).toHaveBeenCalledWith(42, 7, 'editor')
  })

  it('children=delete removes the node and its whole subtree', async () => {
    const conn = fakeDb(2)
    const res = await del(2, 'delete')
    expect(res.status).toBe(200)
    const d = writes(conn).find(([s]) => /DELETE FROM component/i.test(s))
    expect(d).toBeTruthy()
    expect(d![1].map(Number).sort()).toEqual([2, 3, 4])
  })

  it('children=reparent moves the children to the grandparent, re-levels them, then deletes the node', async () => {
    const conn = fakeDb(2)
    const res = await del(2, 'reparent')
    expect(res.status).toBe(200)
    const w = writes(conn)
    const move = w.find(([s]) => /SET parent_component_id/i.test(s))
    expect(move).toBeTruthy()
    expect(move![1]).toEqual([1, 2]) // parent := 1 where parent = 2
    const levelWrites = w.filter(([s]) => /hierarchy_level\s*=/.test(s))
    expect(levelWrites.length).toBeGreaterThan(0)
    const d = w.find(([s]) => /DELETE FROM component/i.test(s))
    expect(d![1].map(Number)).toEqual([2])
    // The node is deleted after its children were moved off it.
    expect(w.indexOf(move!)).toBeLessThan(w.indexOf(d!))
  })

  it('rejects an unknown children option', async () => {
    const conn = fakeDb(2)
    const res = await del(2, 'orphan')
    expect(res.status).toBe(400)
    expect(writes(conn)).toHaveLength(0)
  })

  it('403 for a viewer', async () => {
    const conn = fakeDb(2)
    // A viewer: a member, but below editor.
    vi.mocked(auth.checkProjectAccess).mockImplementation(async (_u, _p, level) => !level || level === 'viewer')
    const res = await del(2, 'delete')
    expect(res.status).toBe(403)
    expect(writes(conn)).toHaveLength(0)
  })

  it('404 "Component not found" for a non-member, and writes nothing', async () => {
    const conn = fakeDb(2)
    vi.mocked(auth.checkProjectAccess).mockResolvedValue(false)
    const res = await del(2, 'delete')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Component not found' })
    expect(writes(conn)).toHaveLength(0)
  })
})
