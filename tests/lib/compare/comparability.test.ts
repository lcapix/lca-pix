import { describe, expect, it } from 'vitest'

import { comparability, type ComparableCase } from '@/lib/compare/comparability'

const run = (over: Partial<NonNullable<ComparableCase['run']>> = {}) => ({
  runId: 1,
  method: 'TRACI 2.1',
  region: 'US',
  functionalUnit: '1 bracket',
  ...over,
})

describe('whether runs may be compared', () => {
  it('passes all four checks for the base case and the shorter cure cycle', () => {
    const r = comparability([
      { caseId: '1', run: run({ runId: 301 }) },
      { caseId: '2', run: run({ runId: 302 }) },
    ])
    expect(r.fair).toBe(true)
    expect(r.failed).toBe(0)
    expect(r.checks.map((c) => c.label)).toEqual(['Same method', 'Same region', 'Same functional unit', 'Both runs current'])
    expect(r.checks.find((c) => c.key === 'method')?.detail).toBe('TRACI 2.1')
  })

  it('fails on a region mismatch and a stale run, naming the cases to run again (E09b)', () => {
    const r = comparability([
      { caseId: '1', run: run() },
      { caseId: '2', run: run({ region: 'Global' }), editedSinceRun: true },
    ])
    expect(r.fair).toBe(false)
    expect(r.failed).toBe(2)
    const region = r.checks.find((c) => c.key === 'region')!
    expect(region.label).toBe('Region differs: US vs Global')
    expect(region.caseIds).toEqual(['2'])
    const current = r.checks.find((c) => c.key === 'current')!
    expect(current.label).toBe('Run is older than the last change')
    expect(current.caseIds).toEqual(['2'])
  })

  it('fails on a method or functional-unit mismatch, and on a missing functional unit', () => {
    expect(comparability([{ caseId: '1', run: run() }, { caseId: '2', run: run({ method: 'CML 2001' }) }]).fair).toBe(false)
    expect(comparability([{ caseId: '1', run: run() }, { caseId: '2', run: run({ functionalUnit: '1 kg' }) }]).fair).toBe(false)
    const missing = comparability([{ caseId: '1', run: run() }, { caseId: '2', run: run({ functionalUnit: '  ' }) }])
    expect(missing.checks.find((c) => c.key === 'functionalUnit')).toMatchObject({ ok: false, caseIds: ['2'] })
  })

  it('needs at least two runs, and says which case has none', () => {
    const one = comparability([{ caseId: '1', run: run() }, { caseId: '2', run: null }])
    expect(one.fair).toBe(false)
    expect(one.checks.find((c) => c.key === 'current')).toMatchObject({ ok: false, label: 'A case has no run', caseIds: ['2'] })
    expect(comparability([]).fair).toBe(false)
  })
})

describe('scopeFair: only a scope mismatch greys the comparison', () => {
  const run = (over: Record<string, unknown> = {}) => ({ runId: 1, method: 'TRACI 2.1', region: 'US', functionalUnit: '1 bracket', ...over })
  it('a stale or missing run fails "current" but keeps the scope fair', () => {
    const r = comparability([
      { caseId: '1', run: run() },
      { caseId: '2', run: run(), editedSinceRun: true },
      { caseId: '3', run: null },
    ])
    expect(r.fair).toBe(false)
    expect(r.scopeFair).toBe(true)
    expect(r.checks.find((c) => c.key === 'current')!.ok).toBe(false)
  })
  it('a region, method or functional unit mismatch is not scope-fair', () => {
    expect(comparability([{ caseId: '1', run: run() }, { caseId: '2', run: run({ region: 'EU' }) }]).scopeFair).toBe(false)
    expect(comparability([{ caseId: '1', run: run() }, { caseId: '2', run: run({ method: 'CML 2001' }) }]).scopeFair).toBe(false)
    expect(comparability([{ caseId: '1', run: run() }, { caseId: '2', run: run({ functionalUnit: '2 brackets' }) }]).scopeFair).toBe(false)
  })
})
