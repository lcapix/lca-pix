/**
 * The one rule for every number that compares two runs (A3, A4, A5, A8, G1):
 * whyNoNumber in lib/project/comparison-banner.ts. A method, region or
 * functional unit difference, or a stale run, gives no percentage anywhere:
 * not in Compare's totals chip, Ranking, verdict or change by category, not
 * in the Results tab or Write-up note, not in the report. When the runs do
 * compare, every place prints the same percentage for the same pair.
 */
import { describe, expect, it } from 'vitest'
import { comparability } from '@/lib/compare/comparability'
import { changePct, changeWords, totalChip, whatChanged } from '@/lib/compare/compare-view'
import { caseVerdict, deltaByCategory } from '@/lib/compare/verdict'
import { whyNoChange, whyNoNumber } from '@/lib/project/comparison-banner'
import { changeText, preparedBy, reportComparison, reportRunLabel, withoutReadOnlyNote, type ReportRunSide } from '@/lib/results/report-text'
import { categoryNumber, headlineNumber } from '@/lib/results/number-view'
import { fixed } from '@/lib/ui/format'

const GW = 'Global Warming'
const AC = 'Acidification'

const kase = (id: string, name: string, gw: number, over: { method?: string; region?: string; stale?: boolean } = {}) => ({
  caseId: id,
  name,
  status: (over.stale ? 'stale' : 'ok') as 'ok' | 'stale',
  run: { runId: Number(id), method: over.method ?? 'TRACI 2.1', region: over.region ?? 'US', functionalUnit: '1 painted steel bracket', stale: !!over.stale },
  totals: [{ category: GW, unit: 'kg CO2 eq', value: gw }],
  byStep: [],
  flows: [],
  costs: [],
})

describe('one percentage per pair', () => {
  it('the totals chip, the Ranking words and the verdict print the same percentage (walk: 14.7% against 14.6%)', () => {
    // 1.7195 shows as 1.720 and 1.4684 as 1.468: a chip read off the rounded
    // totals said 14.7% while the Ranking said 14.6%.
    const a = kase('1', 'Base case', 1.7195)
    const b = kase('2', 'Lighter blank', 1.4684)
    expect(fixed(changePct(1.4684, 1.7195)!, 1)).toBe('-14.6')
    expect(totalChip(1.4684, 1.7195)).toBe('▼ 14.6% lower')
    expect(changeWords(1.4684, 1.7195)).toBe('14.6% lower than A')
    expect(caseVerdict(a, b, GW).line).toBe('Lighter blank is 14.6% lower in Global Warming than Base case.')
  })

  it('the sample against a copy with Steel 0.70 kg: 1.720 to 1.530 is 11.0% lower everywhere', () => {
    const a = kase('1', 'Base case', 1.72)
    const b = kase('2', 'My copy', 1.53)
    expect(totalChip(1.53, 1.72)).toBe('▼ 11.0% lower')
    expect(changeWords(1.53, 1.72)).toBe('11.0% lower than A')
    expect(caseVerdict(a, b, GW).line).toBe('My copy is 11.0% lower in Global Warming than Base case.')
  })
})

describe('A3: no percentage across regions, methods or a stale run', () => {
  it('a region difference fails the checks and every number holds back', () => {
    const a = kase('1', 'Base case', 1.72, { region: 'US' })
    const b = kase('2', 'Lighter blank', 1.468, { region: 'EU' })
    const c = comparability([a, b].map((x) => ({ caseId: x.caseId, name: x.name, run: x.run })))
    expect(c.fair).toBe(false)
    expect(whyNoNumber(a, b)).toBe('Region differs: US vs EU')
    expect(caseVerdict(a, b, GW)).toMatchObject({ pct: null, line: null, why: 'Region differs: US vs EU' })
    expect(deltaByCategory(a, b).rows).toEqual([])
  })

  it('a method difference does too', () => {
    const a = kase('1', 'Base case', 1.72)
    const b = kase('2', 'Lighter blank', 1.53, { method: 'CML 2001' })
    expect(whyNoNumber(a, b)).toBe('Method differs: TRACI 2.1 vs CML 2001')
  })
})

describe('A5: the Results tab and Write-up note against the base', () => {
  it('refuses across methods, regions and a stale run, and allows the same basis', () => {
    const run = { name: 'My copy', method: 'CML 2001', region: 'US' }
    const base = { name: 'Base case', method: 'TRACI 2.1', region: 'US' }
    expect(whyNoChange(run, base)).toBe('Method differs: TRACI 2.1 vs CML 2001')
    expect(whyNoChange({ ...run, method: 'TRACI 2.1', region: 'EU' }, base)).toBe('Region differs: US vs EU')
    expect(whyNoChange({ ...run, method: 'TRACI 2.1', stale: true }, base)).toBe('Run is older than the last change')
    expect(whyNoChange({ ...run, method: 'TRACI 2.1' }, base)).toBeNull()
    // A run with no region recorded is a Global run.
    expect(whyNoChange({ ...run, method: 'TRACI 2.1', region: null }, { ...base, region: 'Global' })).toBeNull()
  })
})

describe('A3: What changed names a method, region or factor difference', () => {
  it('leads with the region and names the electricity factor that moved under an unchanged amount', () => {
    const base = { flows: [{ step: '30. Powder coat and cure', substance: 'Electricity', category: GW, value: 0.14 }] }
    const other = { flows: [{ step: '30. Powder coat and cure', substance: 'Electricity', category: GW, value: 0.09 }] }
    const w = whatChanged(null, other, GW, 'kg CO₂-eq', {
      scope: [{ label: 'Region (electricity grid)', base: 'US', other: 'EU' }],
      base,
    })
    expect(w.main).toBeNull()
    expect(w.lines).toEqual([
      'Region (electricity grid): US → EU. The electricity factor changes with the region.',
      'Electricity at 30. Powder coat and cure: same amount, but its result went 0.140 → 0.090 kg CO₂-eq, so its factor changed',
    ])
  })

  it('says a method difference', () => {
    const w = whatChanged(null, { flows: [] }, GW, 'kg CO₂-eq', { scope: [{ label: 'LCIA method', base: 'TRACI 2.1', other: 'CML 2001' }] })
    expect(w.lines).toEqual(['LCIA method: TRACI 2.1 → CML 2001. Every factor comes from the other method.'])
  })
})

describe('A8: one way to print a run number on both result screens', () => {
  it('the climate answer at the case decimals, everything else at three', () => {
    expect(headlineNumber(1.7199667, GW, 'base')).toBe('1.72')
    expect(headlineNumber(1.53, GW, 'comparative')).toBe('1.530')
    expect(headlineNumber(0.00066, AC, 'base')).toBe('0.001')
    expect(categoryNumber(0.0066)).toBe('0.007')
    expect(categoryNumber(0.0000198)).toBe('< 0.001')
  })
})

describe('G1: the report', () => {
  const side = (over: Partial<ReportRunSide>): ReportRunSide => ({
    caseName: 'Base case',
    runId: 11,
    caseRunNumber: 1,
    method: 'TRACI 2.1',
    region: 'US',
    functionalUnit: '1 painted steel bracket',
    stale: false,
    totals: [
      { category: GW, unit: 'kg CO2 eq', value: 1.72 },
      { category: AC, unit: 'kg SO2 eq', value: 0.00066 },
    ],
    ...over,
  })

  it('names the run as the app does and the person by name', () => {
    expect(reportRunLabel({ run_id: 11, case_run_number: 3 })).toBe('Run 3')
    expect(reportRunLabel({ run_id: 11, case_run_number: null })).toBe('Run #11')
    expect(preparedBy(null, '  ', 'Jordan Journey')).toBe('Jordan Journey')
    expect(preparedBy(null, undefined)).toBe('Name not given')
  })

  it('leaves the sample read-only sentence off an editable copy, and keeps it on the sample', () => {
    const project = 'A finished study to read first. Quantities are illustrative; every factor and rate is real and named. Make your own copy to change it.'
    expect(withoutReadOnlyNote(project, true)).toBe('A finished study to read first. Quantities are illustrative; every factor and rate is real and named.')
    expect(withoutReadOnlyNote('The sample study. Read-only: make your own copy to change it.', true)).toBeNull()
    expect(withoutReadOnlyNote(project, false)).toBe(project)
  })

  it('a comparable copy: both totals, the change and 11.0% lower', () => {
    const c = reportComparison(side({ caseName: 'My copy', runId: 12, caseRunNumber: 3, totals: [{ category: GW, unit: 'kg CO2 eq', value: 1.53 }] }), side({}))
    expect(c.comparable).toBe(true)
    expect(c.baseRun).toBe('Run 1')
    const gw = c.rows.find((r) => r.category === GW)!
    expect(gw).toMatchObject({ base: 1.72, mine: 1.53 })
    expect(changeText(gw, (n) => fixed(n, 3))).toBe('−0.190 (11.0% lower)')
    expect(changeText(c.rows.find((r) => r.category === AC)!, (n) => fixed(n, 3))).toBe('not in both runs')
  })

  it('across methods: both totals, no change, no percentage, and why', () => {
    const c = reportComparison(side({ caseName: 'My copy', method: 'CML 2001', totals: [{ category: GW, unit: 'kg CO2 eq', value: 1.53 }] }), side({}))
    expect(c.comparable).toBe(false)
    expect(c.verdict).toMatch(/^Not comparable: Method differs: TRACI 2\.1 vs CML 2001\./)
    const gw = c.rows.find((r) => r.category === GW)!
    expect(gw).toMatchObject({ base: 1.72, mine: 1.53, change: null, pct: null })
    expect(changeText(gw, (n) => fixed(n, 3))).toBe('not comparable')
  })

  it('a run older than the last change is not compared either', () => {
    const c = reportComparison(side({ caseName: 'My copy', stale: true }), side({}))
    expect(c.comparable).toBe(false)
    expect(c.verdict).toMatch(/Run is older than the last change/)
  })
})
