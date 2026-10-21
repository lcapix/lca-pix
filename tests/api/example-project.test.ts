// POST /api/example-project builds the sample study (lib/sample/). The data and
// its golden totals are checked against a real database in
// tests/api-real/flows/f28-sample-study.test.ts; this file checks the route.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/example-project/route'
import * as auth from '@/lib/auth'
import * as db from '@/lib/db-helpers'
import * as builder from '@/lib/sample/build-sample'
import * as limits from '@/lib/rate-limit'

vi.mock('@/lib/auth')
vi.mock('@/lib/db-helpers')
vi.mock('@/lib/sample/build-sample', async (orig) => ({ ...(await orig<any>()), buildSampleStudy: vi.fn() }))

const call = () =>
  POST(new Request('http://t/api/example-project', { method: 'POST', headers: { Authorization: 'Bearer x' } }) as any)

function conn(existing: unknown[] = []) {
  return { query: vi.fn(async (sql: string) => (/FROM project/.test(sql) ? [existing] : [[]])) }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(auth.requireAuth).mockResolvedValue(42)
  vi.spyOn(limits, 'enforceRateLimit').mockResolvedValue(null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/example-project (the sample study)', () => {
  it('builds inside one transaction, locking the account row first', async () => {
    const c = conn()
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(c))
    vi.mocked(db.queryOne).mockResolvedValue(null)
    vi.mocked(builder.buildSampleStudy).mockResolvedValue({ projectId: 7, baseCaseId: 8, whatIfCaseId: 9, baseRunId: 10, whatIfRunId: 11 })
    const res = await call()
    expect(res.status).toBe(200)
    expect(c.query.mock.calls[0][0]).toMatch(/FROM account WHERE id = \? FOR UPDATE/)
    expect(builder.buildSampleStudy).toHaveBeenCalledWith(c, 42)
    expect((await res.json()).existed).toBe(false)
  })

  it('a repeat returns the sample that exists and builds nothing', async () => {
    vi.mocked(db.queryOne).mockResolvedValue({ project_id: 7 } as any)
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ existed: true, project_id: 7 })
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('a missing library substance is 409 and a failure is 500, with no internal text', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(null)
    vi.mocked(db.transaction).mockImplementation(async (cb: any) => cb(conn()))
    vi.mocked(builder.buildSampleStudy).mockRejectedValueOnce(new builder.SampleUnavailable('no Argon'))
    const unavailable = await call()
    expect(unavailable.status).toBe(409)
    expect((await unavailable.json()).error).not.toMatch(/Argon/)
    vi.mocked(builder.buildSampleStudy).mockRejectedValueOnce(Object.assign(new Error('disk full'), { code: 'ER_DISK_FULL' }))
    const failed = await call()
    expect(failed.status).toBe(500)
    expect((await failed.json()).error).toBe('Could not build the sample study. Nothing was created.')
  })

  it('is rate limited before anything is written', async () => {
    vi.mocked(db.queryOne).mockResolvedValue(null)
    vi.spyOn(limits, 'enforceRateLimit').mockResolvedValue(new Response('{}', { status: 429 }) as any)
    const res = await call()
    expect(res.status).toBe(429)
    expect(db.transaction).not.toHaveBeenCalled()
  })
})
