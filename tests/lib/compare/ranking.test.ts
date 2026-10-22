import { describe, expect, it } from 'vitest'

import { pctChange, rankCases, resultsTable, type RankableCase } from '@/lib/compare/analytics'

const gw = (value: number, flowCount?: number) => [
  { category: 'Global Warming', unit: 'kg CO2 eq', value, ...(flowCount === undefined ? {} : { flowCount }) },
]
const mk = (caseId: string, value: number | null, over: Partial<RankableCase> = {}): RankableCase => ({
  caseId,
  name: `Case ${caseId}`,
  totals: value === null ? [] : gw(value),
  byStep: [],
  flows: [],
  costs: [],
  status: 'ok',
  method: 'TRACI 2.1',
  functionalUnit: '1 bike',
  ...over,
})

describe('pctChange', () => {
  it('measures change against the size of the base, so a negative base keeps the sign', () => {
    expect(pctChange(12, 10)).toBeCloseTo(20)
    expect(pctChange(8, 10)).toBeCloseTo(-20)
    // Net sequestration: -20 is lower (better) than -10, so the change is negative.
    expect(pctChange(-20, -10)).toBeCloseTo(-100)
    expect(pctChange(-5, -10)).toBeCloseTo(50)
  })
  it('is null against a zero or missing base', () => {
    expect(pctChange(5, 0)).toBeNull()
    expect(pctChange(5, null)).toBeNull()
    expect(pctChange(Number.NaN, 1)).toBeNull()
  })
})

describe('rankCases', () => {
  it('names the lowest copy against the base', () => {
    const r = rankCases([mk('1', 100), mk('2', 90), mk('3', 95)], '1', 'Global Warming')
    expect(r.best).toMatchObject({ caseId: '2', value: 90, lower: true })
    expect(r.best!.pct).toBeCloseTo(-10)
    expect(r.ranked.map((x) => x.caseId)).toEqual(['2', '3'])
    expect(r.excluded).toEqual([])
  })

  it('never ranks a 0-flow case, even though its total (0) is the lowest', () => {
    const empty = mk('2', 0, { status: 'incomplete', statusReason: 'No flows yet' } as any)
    const r = rankCases([mk('1', 100), empty, mk('3', 95)], '1', 'Global Warming')
    expect(r.best?.caseId).toBe('3')
    expect(r.ranked.map((x) => x.caseId)).toEqual(['3'])
    expect(r.excluded).toEqual([{ caseId: '2', reason: 'incomplete' }])
  })

  it('never ranks a case whose only copy is incomplete: no winner at all', () => {
    const r = rankCases([mk('1', 100), mk('2', 0, { status: 'incomplete' })], '1', 'Global Warming')
    expect(r.best).toBeNull()
    expect(r.ranked).toEqual([])
  })

  it('never ranks a case with no run (no totals)', () => {
    const r = rankCases([mk('1', 100), mk('2', null, { status: 'incomplete', method: null })], '1', 'Global Warming')
    expect(r.best).toBeNull()
    expect(r.excluded).toEqual([{ caseId: '2', reason: 'incomplete' }])
  })

  it('leaves a category the run computed from no flow unranked', () => {
    const r = rankCases([mk('1', 100), mk('2', 0, { totals: gw(0, 0) })], '1', 'Global Warming')
    expect(r.best).toBeNull()
    expect(r.excluded).toEqual([{ caseId: '2', reason: 'no-result' }])
  })

  it('flags a stale run "re-run to compare" instead of ranking it', () => {
    const r = rankCases([mk('1', 100), mk('2', 50, { status: 'stale' }), mk('3', 99)], '1', 'Global Warming')
    expect(r.best?.caseId).toBe('3')
    expect(r.excluded).toEqual([{ caseId: '2', reason: 'stale' }])
  })

  it('ranks nothing when the base itself is incomplete or stale', () => {
    expect(rankCases([mk('1', 0, { status: 'incomplete' }), mk('2', 90)], '1', 'Global Warming')).toMatchObject({
      best: null,
      ranked: [],
      baseExcluded: 'incomplete',
    })
    expect(rankCases([mk('1', 100, { status: 'stale' }), mk('2', 90)], '1', 'Global Warming').baseExcluded).toBe('stale')
  })

  it('does not rank a copy computed under another method, even if the category names match', () => {
    const r = rankCases([mk('1', 100), mk('2', 10, { method: 'CML 2001' }), mk('3', 98)], '1', 'Global Warming')
    expect(r.best?.caseId).toBe('3')
    expect(r.excluded).toEqual([{ caseId: '2', reason: 'method' }])
  })

  it('does not rank a copy computed per another functional unit', () => {
    const r = rankCases([mk('1', 100), mk('2', 10, { functionalUnit: '1 kg of frame' })], '1', 'Global Warming')
    expect(r.best).toBeNull()
    expect(r.excluded).toEqual([{ caseId: '2', reason: 'functional-unit' }])
  })

  it('handles a negative base without flipping the direction', () => {
    // Base sequesters 10; copy A sequesters 20 (better), copy B only 5 (worse).
    const r = rankCases([mk('1', -10), mk('A', -20), mk('B', -5)], '1', 'Global Warming')
    expect(r.best).toMatchObject({ caseId: 'A', value: -20, lower: true })
    expect(r.best!.pct).toBeCloseTo(-100)
    expect(r.ranked.find((x) => x.caseId === 'B')!.pct).toBeCloseTo(50)
  })

  it('says no copy is lower when none is', () => {
    const r = rankCases([mk('1', -10), mk('B', -5)], '1', 'Global Warming')
    expect(r.best).toMatchObject({ caseId: 'B', lower: false })
    expect(r.best!.pct).toBeCloseTo(50)
  })
})

describe('resultsTable with a negative base', () => {
  it('reports the change against the size of the base', () => {
    const rows = resultsTable([mk('1', -10), mk('2', -20)], '1')
    expect(rows[0].cells[1].delta).toBe(-10)
    expect(rows[0].cells[1].deltaPct).toBeCloseTo(-100)
  })
})
