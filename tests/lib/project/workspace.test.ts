import { describe, it, expect } from 'vitest'
import {
  addCasePath,
  defaultActiveCaseId,
  readRunPrefs,
  runAssessmentBody,
  workspaceKpis,
  workspaceView,
} from '@/lib/project/workspace'
import type { CaseImpact } from '@/lib/project/case-impact'

describe('defaultActiveCaseId', () => {
  it('prefers the base case, else the first', () => {
    expect(defaultActiveCaseId([{ id: '6', type: 'comparative' }, { id: '5', type: 'base' }])).toBe('5')
    expect(defaultActiveCaseId([{ id: '6', type: 'comparative' }, { id: '7', type: 'comparative' }])).toBe('6')
    expect(defaultActiveCaseId([])).toBeNull()
  })
})

describe('addCasePath', () => {
  it('creates the base case first, comparatives after it', () => {
    expect(addCasePath('7', 0)).toBe('/project/7/case/base/new')
    expect(addCasePath('7', 1)).toBe('/project/7/case/comparative/new')
  })
})

describe('workspaceKpis', () => {
  it('shows honest empty states', () => {
    expect(
      workspaceKpis({
        caseCount: 0,
        baseCount: 0,
        comparativeCount: 0,
        componentCount: 0,
        driverCount: 0,
        totalImpact: null,
        impactUnit: 'kg CO₂-eq',
        totalCost: null,
      }),
    ).toEqual([
      { label: 'Cases', value: '0', note: 'Import your routing to create the first case', tone: 'neutral' },
      { label: 'Steps', value: '0', note: 'The routing builds them', tone: 'neutral' },
      { label: 'Global Warming', value: '—', note: 'Run an assessment', tone: 'neutral' },
      { label: 'Cost', value: '—', note: 'Add cost data on operations', tone: 'neutral' },
    ])
  })

  it('formats real numbers', () => {
    const [cases, steps, gw, cost] = workspaceKpis({
      caseCount: 3,
      baseCount: 1,
      comparativeCount: 2,
      componentCount: 4,
      driverCount: 1,
      totalImpact: 1.72345,
      impactUnit: 'kg CO2 eq',
      totalCost: 1234.5,
    })
    expect(cases).toEqual({ label: 'Cases', value: '3', note: '1 base · 2 comparative', tone: 'brand' })
    expect(steps.note).toBe('1 input/output flow')
    expect(gw).toEqual({ label: 'Global Warming', value: '1.723', note: 'kg CO2 eq', tone: 'brand' })
    expect(cost.value).toBe(`$${(1235).toLocaleString()}`)
    expect(cost.note).toBe('Total ABC cost')
  })

  it('keeps a zero result (it is a result) and pluralises flows', () => {
    const [, steps, gw, cost] = workspaceKpis({
      caseCount: 1,
      baseCount: 1,
      comparativeCount: 0,
      componentCount: 2,
      driverCount: 0,
      totalImpact: 0,
      impactUnit: 'kg',
      totalCost: 0,
    })
    expect(steps.note).toBe('0 input/output flows')
    expect(gw.value).toBe('0.000')
    expect(cost.value).toBe('$0')
  })
})

describe('workspaceView', () => {
  const project = {
    cases: [
      { id: '5', type: 'base', name: 'Steel', componentCount: 3, driverCount: 2 },
      { id: '6', type: 'comparative', name: 'Alu', components: [{}, {}] },
    ],
  }
  const impact: CaseImpact = {
    totalImpact: 12,
    unit: 'kg CO2-eq',
    impactByComponent: { Frame: 12 },
    contributors: [{ name: 'Frame', value: 12, pct: 100 }],
    costs: { labor: 1, energy: 2, material: 3, overhead: 4, total: 10 },
  }

  it('splits the cases and finds the active one, else the first', () => {
    const v = workspaceView(project, '6', null)
    expect(v.baseCases.map((c) => c.id)).toEqual(['5'])
    expect(v.comparativeCases.map((c) => c.id)).toEqual(['6'])
    expect(v.activeCase.id).toBe('6')
    expect(v.componentCount).toBe(2)
    expect(v.driverCount).toBe(0)
    expect(v.projectTypeLabel).toBe('comparative')
    expect(v.showComparisonBanner).toBe(true)
    expect(workspaceView(project, 'missing', null).activeCase.id).toBe('5')
    expect(workspaceView(project, null, null).activeCase.id).toBe('5')
  })

  it('takes the numbers from the latest run and the cost columns', () => {
    const v = workspaceView(project, '5', impact)
    expect(v.assessed).toBe(true)
    expect(v.totalImpact).toBe(12)
    expect(v.impactUnit).toBe('kg CO2-eq')
    expect(v.totalCost).toBe(10)
    expect(v.contributors).toEqual([{ name: 'Frame', value: 12, pct: 100 }])
    expect(v.kpis.map((k) => k.value)).toEqual(['2', '3', '12.000', '$10'])
  })

  it('has no contributors, cost or assessment without a run', () => {
    const v = workspaceView(project, '5', { ...impact, totalImpact: null, contributors: [], costs: null })
    expect(v.assessed).toBe(false)
    expect(v.totalImpact).toBeNull()
    expect(v.totalCost).toBeNull()
    expect(v.contributors).toEqual([])
  })

  it('counts a case marked assessed even before its run loads', () => {
    expect(workspaceView({ cases: [{ id: '5', type: 'base', assessed: true }] }, '5', null).assessed).toBe(true)
  })

  it('handles a project with no cases', () => {
    const v = workspaceView({}, null, null)
    expect(v.activeCase).toBeNull()
    expect(v.projectTypeLabel).toBe('base')
    expect(v.showComparisonBanner).toBe(false)
    expect(v.impactUnit).toBe('kg CO₂-eq')
    expect(v.componentCount).toBe(0)
  })
})

describe('readRunPrefs', () => {
  it('reads the per-case method and region', () => {
    const store: Record<string, string> = { 'lcapix-run-prefs:5': '{"method":"TRACI 2.1","region":"US"}' }
    expect(readRunPrefs((k) => store[k] ?? null, '5')).toEqual({ method: 'TRACI 2.1', region: 'US' })
    expect(readRunPrefs((k) => store[k] ?? null, '6')).toEqual({})
  })
  it('ignores corrupt or unreadable prefs', () => {
    expect(readRunPrefs(() => '{not json', '5')).toEqual({})
    expect(
      readRunPrefs(() => {
        throw new Error('storage blocked')
      }, '5'),
    ).toEqual({})
  })
})

describe('runAssessmentBody', () => {
  it('names the run and leaves out what was never chosen', () => {
    expect(runAssessmentBody('Steel', {})).toEqual({ run_name: 'Steel run' })
    expect(runAssessmentBody('Steel', { method: 'CML 2001', region: 'EU' })).toEqual({
      run_name: 'Steel run',
      calculation_method: 'CML 2001',
      region_code: 'EU',
    })
    expect(runAssessmentBody('Steel', { method: '', region: 'US' })).toEqual({ run_name: 'Steel run', region_code: 'US' })
  })
})
