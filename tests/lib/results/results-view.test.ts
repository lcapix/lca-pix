import { describe, it, expect } from 'vitest'
import {
  IMPACT_CATEGORIES,
  buildCategoryItems,
  exportFileName,
  factorTitle,
  flowTableRows,
  historyTimelineRuns,
  isGlobalFallback,
  isWeakFactorSource,
  lastRunLabel,
  primaryCategoryKey,
  safeRunDate,
  stagePanelInput,
} from '@/lib/results/results-view'
import { buildAssessmentResult, toAssessmentResult, type AssessmentResult } from '@/lib/results/assessment'
import {
  insightsBreakdownOf,
  insightsMaterialsOf,
  insightsStepCostsOf,
  numCost,
  realCaseCost,
} from '@/lib/results/insights-inputs'

const baseRun = (over: Partial<AssessmentResult> = {}): AssessmentResult => ({
  run_id: 8,
  run_name: 'Run 8',
  calculation_method: 'TRACI 2.1',
  status: 'completed',
  run_date: '2026-09-18T10:00:00Z',
  executed_by_username: 'u',
  impacts: {},
  costs: { operational: 0, capital: 0, total: 0 },
  componentBreakdown: [],
  flowDetail: [],
  ...over,
})

describe('toAssessmentResult', () => {
  it('fills the defaults a list row may lack', () => {
    const r = toAssessmentResult({ run_id: 1, run_name: 'R', calculation_method: 'CML 2001', status: 'completed', run_date: 'x', executed_by_username: 'u' })
    expect(r.impacts).toEqual({})
    expect(r.costs).toEqual({ operational: 0, capital: 0, total: 0 })
    expect(r.componentBreakdown).toEqual([])
    expect(r.flowDetail).toEqual([])
    expect(r.warnings).toEqual([])
    expect(r.regionCode).toBeUndefined()
    expect(r.goalScope).toBeNull()
    expect(r.dataQuality).toBeNull()
  })
  it('maps snake_case snapshot fields', () => {
    const r = toAssessmentResult({ run_id: 1, region_code: 'US', goal_scope: { functional_unit: '1 kg' }, data_quality: { statement: [] }, warnings: ['w'] })
    expect(r.regionCode).toBe('US')
    expect(r.goalScope).toEqual({ functional_unit: '1 kg' })
    expect(r.dataQuality).toEqual({ statement: [] })
    expect(r.warnings).toEqual(['w'])
  })
})

describe('buildAssessmentResult', () => {
  const data = {
    assessment: { run_id: 20, run_name: 'New', calculation_method: 'CML 2001', status: 'completed', run_date: 'd', executed_by_username: 'u', region_code: 'EU' },
    total_impacts: [
      { category_name: 'Global warming', impact_value: 3, unit: 'kg CO2 eq' },
      { category_name: 'Acidification', impact_value: -1, unit: 'kg SO2 eq' },
    ],
  }
  it('keys impacts by category and keeps the region', () => {
    const r = buildAssessmentResult(data, [])
    expect(r.impacts).toEqual({ 'Global warming': { value: 3, unit: 'kg CO2 eq' }, Acidification: { value: -1, unit: 'kg SO2 eq' } })
    expect(r.regionCode).toBe('EU')
    expect(r.algorithmSteps).toEqual([])
    expect(r.componentBreakdown).toEqual([])
  })
  it('costs only the components that carry drivers', () => {
    const r = buildAssessmentResult(data, [
      { driverCategory: 'energy', drivers: ['a'], operationalCostUSD: 10, capitalCostUSD: 5 },
      { driverCategory: 'energy', drivers: [], operationalCostUSD: 100 },
      { drivers: ['a'], operationalCostUSD: 1000 },
    ])
    expect(r.costs).toEqual({ operational: 10, capital: 5, total: 15 })
    expect(buildAssessmentResult(data, undefined).costs.total).toBe(0)
  })
})

describe('buildCategoryItems / primaryCategoryKey', () => {
  it('falls back to the canonical categories at zero without a run', () => {
    const items = buildCategoryItems(null)
    expect(items.map((i) => i.key)).toEqual(Object.keys(IMPACT_CATEGORIES))
    expect(items.every((i) => i.value === 0)).toBe(true)
    expect(primaryCategoryKey(items)).toBe('Global warming')
  })
  it('lists the run categories with coverage only when partial', () => {
    const run = baseRun({
      impacts: { Acidification: { value: 2, unit: 'kg SO2 eq' }, 'Climate change': { value: -4, unit: 'kg CO2 eq' } },
      dataQuality: {
        category_coverage: [
          { category: 'Acidification', covered: 1, total: 3, missing_examples: ['Epoxy'] },
          { category: 'Climate change', covered: 3, total: 3, missing_examples: [] },
        ],
      } as any,
    })
    const items = buildCategoryItems(run)
    expect(items).toEqual([
      { key: 'Acidification', label: 'Acidification', value: 2, unit: 'kg SO2 eq', coverage: { covered: 1, total: 3, missing: ['Epoxy'] } },
      { key: 'Climate change', label: 'Climate change', value: -4, unit: 'kg CO2 eq', coverage: undefined },
    ])
    // "Climate change" is not matched: only global warming / carbon / CO2 count as primary.
    expect(primaryCategoryKey(items)).toBe('Acidification')
  })
  it('prefers a carbon / CO2 category and is empty for no items', () => {
    expect(primaryCategoryKey([{ key: 'Water', label: 'Water', value: 0, unit: '' }, { key: 'CO2 total', label: '', value: 0, unit: '' }])).toBe('CO2 total')
    expect(primaryCategoryKey([])).toBe('')
  })
})

describe('flowTableRows', () => {
  const run = baseRun({
    flowDetail: [
      { flow_id: 1, component: 'Frame', substance: 'Al', category_name: 'GW', dir: 'IN', amount: 1, unit: 'kg', factor: 2, impact: 2, scope: 'US', source: 'EPA', source_tier: 'authoritative' },
      { flow_id: 2, component: 'Frame', substance: 'CO2', category_name: 'GW', dir: 'OUT', amount: 1, unit: 'kg', factor: 1, impact: 1 },
      { flow_id: 3, component: 'Frame', substance: 'SO2', category_name: 'AP', dir: 'OUT', amount: 1, unit: 'kg', factor: 1, impact: 1, allocation: 0.5 },
    ],
  })
  it('keeps the active category and filters by direction', () => {
    expect(flowTableRows(run, { key: 'GW' }, 'all').map((r) => r.id)).toEqual(['1', '2'])
    expect(flowTableRows(run, { key: 'GW' }, 'in').map((r) => r.id)).toEqual(['1'])
    expect(flowTableRows(run, { key: 'GW' }, 'out').map((r) => r.id)).toEqual(['2'])
    expect(flowTableRows(run, undefined, 'all')).toHaveLength(3)
    expect(flowTableRows(null, { key: 'GW' }, 'all')).toEqual([])
  })
  it('maps provenance with null defaults', () => {
    const [a, b] = flowTableRows(run, { key: 'GW' }, 'all')
    expect(a).toMatchObject({ sourceTier: 'authoritative', source: 'EPA', allocation: null, scope: 'US' })
    expect(b).toMatchObject({ sourceTier: null, source: null, allocation: null, scope: undefined })
    expect(flowTableRows(run, { key: 'AP' }, 'all')[0].allocation).toBe(0.5)
  })
})

describe('factor provenance helpers', () => {
  it('describes the source and its tier', () => {
    expect(factorTitle('EPA', 'authoritative')).toBe('Source: EPA (authoritative published source)')
    expect(factorTitle('EPA', 'odd')).toBe('Source: EPA (odd)')
    expect(factorTitle('EPA', null)).toBe('Source: EPA')
    expect(factorTitle(null, 'unknown')).toBe('no source recorded')
    expect(factorTitle(null, null)).toBeUndefined()
  })
  it('flags unverified and unknown sources only', () => {
    expect(isWeakFactorSource('unverified')).toBe(true)
    expect(isWeakFactorSource('unknown')).toBe(true)
    expect(isWeakFactorSource('industry_average')).toBe(false)
    expect(isWeakFactorSource(null)).toBe(false)
  })
  it('marks a Global factor as a fallback only for a non-Global run', () => {
    expect(isGlobalFallback('Global', 'US')).toBe(true)
    expect(isGlobalFallback('Global', 'Global')).toBe(false)
    expect(isGlobalFallback('US', 'US')).toBe(false)
    expect(isGlobalFallback(undefined, 'US')).toBe(false)
  })
})

describe('historyTimelineRuns', () => {
  const runs = [
    baseRun({ run_id: 9, status: 'failed', impacts: {} }),
    baseRun({ run_id: 8, impacts: { GW: { value: 2, unit: 'kg' } }, run_date: '2026-09-18T10:00:00Z' }),
    baseRun({ run_id: 7, status: 'partial', impacts: { GW: { value: 3, unit: 'kg' } }, run_date: 'not a date' }),
    baseRun({ run_id: 6, status: 'success', impacts: { GW: { value: -1, unit: 'kg' } }, run_date: '2026-09-02T10:00:00Z' }),
  ]
  it('lists the runs with a value, oldest first, with status and date labels', () => {
    expect(historyTimelineRuns(runs, { key: 'GW' })).toEqual([
      { id: 6, timestamp: 'Sep 02', totalImpact: -1, status: 'success' },
      { id: 7, timestamp: 'recent', totalImpact: 3, status: 'partial' },
      { id: 8, timestamp: 'Sep 18', totalImpact: 2, status: 'success' },
    ])
  })
  it('is empty without an active category', () => {
    expect(historyTimelineRuns(runs, undefined)).toEqual([])
  })
  it('marks any other status as an error', () => {
    expect(historyTimelineRuns([baseRun({ status: 'weird', impacts: { GW: { value: 1, unit: '' } } })], { key: 'GW' })[0].status).toBe('error')
  })
})

describe('costs', () => {
  it('reads a cost column as a number', () => {
    expect(numCost('12.5')).toBe(12.5)
    expect(numCost(null)).toBe(0)
    expect(numCost(undefined)).toBe(0)
    expect(numCost('abc')).toBe(0)
  })
  it('sums every cost column of every component', () => {
    expect(
      realCaseCost([
        { laborCost: 10, energyCost: '2.5', materialCost: 1, overheadCost: 1, equipmentCost: 1, transportationCost: 1, operationalCostUSD: 3, capitalCostUSD: 100 },
        { materialCost: 'x' },
      ]),
    ).toBe(119.5)
    expect(realCaseCost([])).toBe(0)
  })
})

describe('labels', () => {
  it('says Never without a run and Recent for a bad date', () => {
    expect(lastRunLabel(null)).toBe('Never')
    expect(lastRunLabel({ run_date: 'garbage' })).toBe('Recent')
    expect(lastRunLabel({ run_date: '2026-09-18T10:00:00Z' })).toBe(new Date('2026-09-18T10:00:00Z').toLocaleString())
  })
  it('formats the header run date', () => {
    expect(safeRunDate(null)).toBe('Recent')
    expect(safeRunDate('')).toBe('Recent')
    expect(safeRunDate('nope')).toBe('Recent')
    expect(safeRunDate('2026-09-18T10:00:00Z')).toBe(
      new Date('2026-09-18T10:00:00Z').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    )
  })
  it('names exports after the case, else the run', () => {
    expect(exportFileName('pdf', 'Touring bike #2', 8)).toBe('LCAPIX_Report_Touring_bike__2.pdf')
    expect(exportFileName('pptx', 'A', 8)).toBe('LCAPIX_Report_A.pptx')
    expect(exportFileName('csv', undefined, 8)).toBe('LCAPIX_inventory_8.csv')
  })
})

describe('stagePanelInput', () => {
  const breakdown = [
    { component_id: 1, component_name: 'Frame', component_type: 'op', life_cycle_stage: 'materials', flows_processed: 2, impacts: [{ category_id: 1, category_name: 'Global Warming', impact_value: 5, unit: 'kg' }] },
    { component_id: 2, component_name: 'Glue', component_type: 'op', flows_processed: 0, impacts: [{ category_id: 2, category_name: 'Acidification', impact_value: 1, unit: 'kg' }] },
  ]
  it('uses the global-warming category and each step value in it', () => {
    const s = stagePanelInput(baseRun({ impacts: { Acidification: { value: 1, unit: 'kg SO2' }, 'Global Warming': { value: 5, unit: 'kg CO2' } }, componentBreakdown: breakdown }))
    expect(s).toEqual({
      categoryName: 'Global Warming',
      unit: 'kg CO2',
      rows: [
        { component_name: 'Frame', life_cycle_stage: 'materials', value: 5, flows: 2 },
        { component_name: 'Glue', life_cycle_stage: null, value: 0, flows: 0 },
      ],
    })
  })
  it('falls back to the first category, and is null without impacts', () => {
    expect(stagePanelInput(baseRun({ impacts: { Acidification: { value: 1, unit: 'kg SO2' } }, componentBreakdown: breakdown }))!.rows.map((r) => r.value)).toEqual([0, 1])
    expect(stagePanelInput(baseRun())).toBeNull()
  })
})

describe('Magic Insights inputs', () => {
  const run = baseRun({
    componentBreakdown: [{ component_id: 1, component_name: 'Frame', component_type: 'op', flows_processed: 1, impacts: [{ category_id: 1, category_name: 'GW', impact_value: 2, unit: 'kg' }] }],
    flowDetail: [{ flow_id: 1, component: 'Frame', substance: 'Al', category_name: 'GW', dir: 'IN', amount: 1, unit: 'kg', factor: 1, impact: 'x' as any, source_tier: 'unknown' }],
  })
  it('strips the breakdown to what the modal reads', () => {
    expect(insightsBreakdownOf(run)).toEqual([{ component_id: 1, component_name: 'Frame', impacts: [{ category_name: 'GW', impact_value: 2, unit: 'kg' }] }])
    expect(insightsBreakdownOf(null)).toBeUndefined()
  })
  it('names each flow by material and step; a non-numeric impact is 0', () => {
    expect(insightsMaterialsOf(run)).toEqual([{ category_name: 'GW', name: 'Al', value: 0, step: 'Frame', tier: 'unknown' }])
    expect(insightsMaterialsOf(undefined)).toEqual([])
  })
  it('splits each step cost into labor, material, energy and other', () => {
    expect(
      insightsStepCostsOf([{ id: 3, name: 'Frame', laborCost: '1', materialCost: 2, energyCost: 3, overheadCost: 1, equipmentCost: 1, transportationCost: 1, operationalCostUSD: 1, capitalCostUSD: 1 }]),
    ).toEqual([{ id: '3', name: 'Frame', labor: 1, material: 2, energy: 3, other: 5 }])
    expect(insightsStepCostsOf(undefined)).toEqual([])
  })
})
