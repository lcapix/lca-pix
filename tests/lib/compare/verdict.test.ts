import { describe, expect, it } from 'vitest'
import { caseVerdict, deltaByCategory } from '@/lib/compare/verdict'

// Arithmetic inputs only (the sample's two case names): each test checks when
// the verdict and the change by category may print a number.
const GW = 'Global Warming'
const AC = 'Acidification'
const OD = 'Ozone Depletion'
const cost = (material: number) => [{ step: '10. Cut blank', material, labor: 0, energy: 0, transportation: 0, equipment: 0, overhead: 0, opex: 0, capex: 0 }]
const kase = (
  name: string,
  totals: Array<[string, number]>,
  opts: { region?: string; method?: string; status?: 'ok' | 'incomplete' | 'stale'; material?: number } = {},
) => ({
  caseId: name,
  name,
  status: opts.status ?? 'ok',
  run: { runId: 1, method: opts.method ?? 'TRACI 2.1', region: opts.region ?? 'US', functionalUnit: '1 bracket' },
  totals: totals.map(([category, value]) => ({ category, unit: 'kg', value })),
  costs: opts.material === undefined ? [] : cost(opts.material),
})
const A = 'Painted steel bracket'
const B = 'My bracket'

describe('P51 the verdict', () => {
  it('P51 B lower: B comes out ahead, one decimal', () => {
    const v = caseVerdict(kase(A, [[GW, 2]]), kase(B, [[GW, 1.754]]), GW)
    expect(v.pct).toBeCloseTo(-12.3, 5)
    expect(v.ahead).toBe(B)
    expect(v.line).toBe('My bracket is 12.3% lower in Global Warming than Painted steel bracket.')
    expect(v.why).toBeNull()
  })
  it('P51 B higher: A comes out ahead, the sign follows (B − A) / |A|', () => {
    const v = caseVerdict(kase(A, [[GW, 2]]), kase(B, [[GW, 2.5]]), GW)
    expect(v.pct).toBeCloseTo(25, 5)
    expect(v.ahead).toBe(A)
    expect(v.line).toBe('My bracket is 25.0% higher in Global Warming than Painted steel bracket.')
  })
  it('P51 a negative A divides by |A|: a smaller B is lower', () => {
    const v = caseVerdict(kase(A, [[GW, -2]]), kase(B, [[GW, -3]]), GW)
    expect(v.pct).toBeCloseTo(-50, 5)
    expect(v.ahead).toBe(B)
  })
  it('P51 uses the selected category', () => {
    const v = caseVerdict(kase(A, [[GW, 2], [AC, 4]]), kase(B, [[GW, 1], [AC, 5]]), AC)
    expect(v.line).toBe('My bracket is 25.0% higher in Acidification than Painted steel bracket.')
  })
  it('P51 a failed check gives no percentage and no cost, only why', () => {
    for (const [b, why] of [
      [kase(B, [[GW, 1]], { region: 'Global', material: 2 }), 'Region differs: US vs Global'],
      [kase(B, [[GW, 1]], { method: 'CML 2001', material: 2 }), 'Method differs: TRACI 2.1 vs CML 2001'],
      [kase(B, [[GW, 1]], { status: 'stale', material: 2 }), 'Run is older than the last change'],
      [kase(B, [[GW, 1]], { status: 'incomplete', material: 2 }), 'My bracket has no complete run yet.'],
    ] as const) {
      const v = caseVerdict(kase(A, [[GW, 2]], { material: 3 }), b, GW)
      expect(v).toMatchObject({ pct: null, line: null, ahead: null, cost: null, costDelta: null, why })
    }
  })
  it('P51 a case with no run gives no number', () => {
    const v = caseVerdict(kase(A, [[GW, 2]]), { ...kase(B, [[GW, 1]]), run: null }, GW)
    expect(v.pct).toBeNull()
    expect(v.why).toBe('A case has no run')
  })
  it('P51 A at 0 in the category: no percentage, says so', () => {
    const v = caseVerdict(kase(A, [[GW, 0]]), kase(B, [[GW, 1]]), GW)
    expect(v.pct).toBeNull()
    expect(v.why).toBe('Painted steel bracket is 0 in Global Warming, so a percentage against it has no meaning.')
  })
  it('P51 a category one side lacks: no percentage, names the side', () => {
    const v = caseVerdict(kase(A, [[GW, 2], [AC, 1]]), kase(B, [[GW, 1]]), AC)
    expect(v.pct).toBeNull()
    expect(v.why).toBe('My bracket has no result in Acidification, so there is no percentage.')
  })
  it('P51 cost difference only when both carry cost', () => {
    expect(caseVerdict(kase(A, [[GW, 2]], { material: 3 }), kase(B, [[GW, 1]], { material: 2.88 }), GW).cost).toBe(
      'My bracket costs $0.12 less than Painted steel bracket, per functional unit.',
    )
    expect(caseVerdict(kase(A, [[GW, 2]], { material: 3 }), kase(B, [[GW, 1]], { material: 3.5 }), GW).costDelta).toBeCloseTo(0.5, 5)
    expect(caseVerdict(kase(A, [[GW, 2]], { material: 3 }), kase(B, [[GW, 1]]), GW).cost).toBeNull()
  })
  it('P51 a change under 0.05% reads as the same, with nobody ahead', () => {
    const v = caseVerdict(kase(A, [[GW, 2]]), kase(B, [[GW, 2.0001]]), GW)
    expect(v.ahead).toBeNull()
    expect(v.line).toBe('My bracket and Painted steel bracket are the same in Global Warming, within 0.1%.')
  })
})

describe('P54 change by category', () => {
  it('P54 one bar per category both runs computed, signed', () => {
    const d = deltaByCategory(kase(A, [[GW, 2], [AC, 4]]), kase(B, [[GW, 1.5], [AC, 5]]))
    expect(d.why).toBeNull()
    expect(d.rows.map((r) => [r.category, Number(r.pct.toFixed(1))])).toEqual([
      [GW, -25],
      [AC, 25],
    ])
    expect(d.summary).toBe('My bracket against Painted steel bracket, by impact category: Global Warming 25.0% lower; Acidification 25.0% higher.')
  })
  it('P54 a category one side lacks is not counted, never a zero bar', () => {
    const d = deltaByCategory(kase(A, [[GW, 2], [OD, 1]]), kase(B, [[GW, 1], [AC, 3]]))
    expect(d.rows.map((r) => r.category)).toEqual([GW])
    expect(d.notCounted).toEqual([
      { category: OD, missingIn: B },
      { category: AC, missingIn: A },
    ])
    expect(d.summary).toContain('Not counted: Ozone Depletion (no result in My bracket), Acidification (no result in Painted steel bracket).')
  })
  it('P54 a total with no flows behind it counts as no result', () => {
    const a = kase(A, [[GW, 2], [AC, 0]])
    a.totals[1] = { ...a.totals[1], flowCount: 0 } as (typeof a.totals)[number]
    const d = deltaByCategory(a, kase(B, [[GW, 1], [AC, 1]]))
    expect(d.notCounted).toEqual([{ category: AC, missingIn: A }])
  })
  it('P54 A at 0: no bar, no percentage, named', () => {
    const d = deltaByCategory(kase(A, [[GW, 2], [AC, 0]]), kase(B, [[GW, 1], [AC, 1]]))
    expect(d.rows.map((r) => r.category)).toEqual([GW])
    expect(d.zeroBase).toEqual([AC])
    expect(d.summary).toContain('No percentage where Painted steel bracket is 0: Acidification.')
  })
  it('P54 a failed check draws nothing and says why', () => {
    const d = deltaByCategory(kase(A, [[GW, 2]]), kase(B, [[GW, 1]], { region: 'Global' }))
    expect(d).toMatchObject({ rows: [], zeroBase: [], notCounted: [], why: 'Region differs: US vs Global' })
    expect(d.summary).toBe('No change by category: Region differs: US vs Global')
  })
})
