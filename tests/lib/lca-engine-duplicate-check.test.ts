import { describe, it, expect, vi } from 'vitest'

import { calculateCaseImpacts } from '@/lib/lca-engine'

// The double-count check is advisory: a run must not fail because it could not
// be made. But a skipped check must say so on the run, or it reads as "no
// double counts" (stage-0 gate, 2026-10-14).

const DUPLICATE_QUERY = /s\.substance_name\s+FROM flows f\s+JOIN component c/

function connection(failDuplicateCheck: boolean) {
  return {
    query: vi.fn(async (sql: string) => {
      if (failDuplicateCheck && DUPLICATE_QUERY.test(sql)) {
        throw Object.assign(new Error('Lock wait timeout exceeded'), { code: 'ER_LOCK_WAIT_TIMEOUT' })
      }
      return [[]]
    }),
  } as any
}

describe('engine double-count check', () => {
  it('says on the run when the check could not run, and the run still completes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const conn = connection(true)
    const result = await calculateCaseImpacts(3, conn)
    expect(conn.query.mock.calls.some(([sql]: [string]) => DUPLICATE_QUERY.test(sql))).toBe(true)
    expect(result.warnings).toContain(
      'The double-count check could not run, so a substance counted twice on one path would not be flagged in this run (ER_LOCK_WAIT_TIMEOUT).',
    )
    warn.mockRestore()
  })

  it('adds no such warning when the check runs', async () => {
    const result = await calculateCaseImpacts(3, connection(false))
    expect(result.warnings.some((w: string) => w.includes('double-count check could not run'))).toBe(false)
  })
})
