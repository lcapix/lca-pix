import { describe, it, expect } from 'vitest'
import {
  analyticsSubtitle,
  barSeriesLabels,
  buildBarGroups,
  buildComponentDiffRows,
  caseCardDelta,
  categoryNameUnion,
  componentNameUnion,
  componentTotal,
  deriveAnalytics,
  findBestComparison,
  findGwpCategory,
  gwpTotalScore,
  gwpUnit,
  pickBaseCase,
  shortCaseName,
} from '@/lib/analytics/derive'
import { EMPTY_COSTS } from '@/lib/analytics/constants'
import type { AnalyticsComponent, AssessmentData } from '@/lib/analytics/types'

const cat = (category_name: string, impact_value: number, unit = 'u') => ({
  category_name,
  impact_value,
  unit,
})

const comp = (component_name: string, values: number[]): AnalyticsComponent => ({
  component_name,
  component_type: 'operation',
  impacts: values.map((v, i) => ({ category_name: `C${i}`, impact_value: v })),
})

const mk = (
  caseName: string,
  totalScore: number,
  extra: Partial<AssessmentData> = {},
): AssessmentData => ({
  caseId: `id-${caseName}`,
  caseName,
  caseType: undefined as unknown as string,
  categories: [],
  components: [],
  totalScore,
  costs: { ...EMPTY_COSTS },
  ...extra,
})

describe('findGwpCategory / gwpTotalScore / gwpUnit', () => {
  const categories = [
    cat('Acidification', 3, 'kg SO2 eq'),
    cat('Climate change', -12.5, 'kg CO2 eq'),
    cat('Global Warming', 7, 'kg CO2e'),
  ]

  it('matches global warming or climate, case-insensitively, first match wins', () => {
    expect(findGwpCategory(categories)?.category_name).toBe('Climate change')
    expect(findGwpCategory([cat('GLOBAL WARMING potential', 1)])?.category_name).toBe(
      'GLOBAL WARMING potential',
    )
    expect(findGwpCategory([cat('Ozone depletion', 1)])).toBeUndefined()
  })

  it('keeps the sign of a GWP credit as the headline', () => {
    expect(gwpTotalScore(categories)).toBe(-12.5)
  })

  it('is 0 without a GWP category or categories', () => {
    expect(gwpTotalScore([cat('Ozone depletion', 1)])).toBe(0)
    expect(gwpTotalScore([])).toBe(0)
  })

  it('reads the GWP unit, defaulting to kg CO₂-eq when missing or blank', () => {
    expect(gwpUnit(categories)).toBe('kg CO2 eq')
    expect(gwpUnit([cat('Ozone depletion', 1)])).toBe('kg CO₂-eq')
    expect(gwpUnit([cat('Climate change', 1, '')])).toBe('kg CO₂-eq')
  })
})

describe('pickBaseCase', () => {
  it('prefers caseType "base", else the first case', () => {
    const a = mk('A', 1)
    const b = mk('B', 2, { caseType: 'base' })
    expect(pickBaseCase([a, b])).toBe(b)
    expect(pickBaseCase([a, mk('C', 3)])).toBe(a)
    expect(pickBaseCase([])).toBeUndefined()
  })
})

describe('categoryNameUnion / buildBarGroups / barSeriesLabels', () => {
  const a = mk('A', 1, { categories: [cat('GWP', 10), cat('AP', 2)] })
  const b = mk('B', 2, { categories: [cat('EP', -1), cat('GWP', 5)] })

  it('unions category names in first-seen order', () => {
    expect(categoryNameUnion([a, b])).toEqual(['GWP', 'AP', 'EP'])
    expect(categoryNameUnion([])).toEqual([])
  })

  it('builds one group per category with each case value, 0 when missing, signs kept', () => {
    expect(buildBarGroups([a, b], ['GWP', 'AP', 'EP'])).toEqual([
      { label: 'GWP', values: [10, 5] },
      { label: 'AP', values: [2, 0] },
      { label: 'EP', values: [0, -1] },
    ])
  })

  it('has no groups or labels without cases', () => {
    expect(buildBarGroups([], ['GWP'])).toEqual([])
    expect(barSeriesLabels([])).toEqual([])
  })

  it('labels series with the case names', () => {
    expect(barSeriesLabels([a, b])).toEqual(['A', 'B'])
  })
})

describe('componentNameUnion', () => {
  it('unions component names in first-seen order', () => {
    const a = mk('A', 1, { components: [comp('Frame', [1]), comp('Wheels', [2])] })
    const b = mk('B', 1, { components: [comp('Paint', [1]), comp('Frame', [3])] })
    expect(componentNameUnion([a, b])).toEqual(['Frame', 'Wheels', 'Paint'])
    expect(componentNameUnion([])).toEqual([])
  })
})

describe('findBestComparison', () => {
  it('is null with fewer than two cases or no baseline', () => {
    const a = mk('A', 10)
    expect(findBestComparison([a], a)).toBeNull()
    expect(findBestComparison([], undefined)).toBeNull()
    expect(findBestComparison([a, mk('B', 5)], undefined)).toBeNull()
  })

  it('picks the lowest-GWP non-baseline case (first on ties) and its reduction', () => {
    const base = mk('Base', 10)
    const b = mk('B', 8)
    const c = mk('C', 4)
    const d = mk('D', 4)
    const result = findBestComparison([b, base, c, d], base)
    expect(result?.best).toBe(c)
    expect(result?.deltaPct).toBeCloseTo(60)
  })

  it('reports an increase as a negative reduction', () => {
    const base = mk('Base', 10)
    const result = findBestComparison([base, mk('B', 15)], base)
    expect(result?.deltaPct).toBeCloseTo(-50)
  })

  it('handles a credit (negative) comparison case', () => {
    const base = mk('Base', 10)
    const result = findBestComparison([base, mk('B', -5)], base)
    expect(result?.deltaPct).toBeCloseTo(150)
  })

  it('is null when the baseline GWP is zero or a credit', () => {
    expect(findBestComparison([mk('Base', 0), mk('B', -1)], undefined)).toBeNull()
    const zero = mk('Base', 0)
    expect(findBestComparison([zero, mk('B', -1)], zero)).toBeNull()
    const credit = mk('Base', -3)
    expect(findBestComparison([credit, mk('B', -10)], credit)).toBeNull()
  })
})

describe('caseCardDelta', () => {
  it('is null for the baseline itself', () => {
    const base = mk('Base', 10)
    expect(caseCardDelta(base, base)).toBeNull()
  })

  it('is the % change vs the baseline (by identity, not by value)', () => {
    const base = mk('Base', 10)
    expect(caseCardDelta(mk('B', 8), base)).toBeCloseTo(-20)
    expect(caseCardDelta(mk('C', 15), base)).toBeCloseTo(50)
    expect(caseCardDelta(mk('Base', 10), base)).toBe(0)
    expect(caseCardDelta(mk('D', -10), base)).toBeCloseTo(-200)
  })

  it('is null without a baseline or with a non-positive baseline GWP', () => {
    expect(caseCardDelta(mk('B', 8), undefined)).toBeNull()
    expect(caseCardDelta(mk('B', 8), mk('Base', 0))).toBeNull()
    expect(caseCardDelta(mk('B', 8), mk('Base', -4))).toBeNull()
  })
})

describe('analyticsSubtitle', () => {
  it('describes none, one or several assessed cases', () => {
    expect(analyticsSubtitle(0)).toBe('No assessments yet · run one to populate analytics')
    expect(analyticsSubtitle(1)).toBe(
      '1 assessed case · duplicate it and change one thing to compare',
    )
    expect(analyticsSubtitle(3)).toBe('Comparing 3 assessed cases')
  })
})

describe('componentTotal', () => {
  it('sums a component impacts over categories, signs kept', () => {
    const d = mk('A', 1, { components: [comp('Frame', [10, -4, 0.5])] })
    expect(componentTotal(d, 'Frame')).toBeCloseTo(6.5)
  })

  it('uses the first component with the name', () => {
    const d = mk('A', 1, { components: [comp('Frame', [1]), comp('Frame', [100])] })
    expect(componentTotal(d, 'Frame')).toBe(1)
  })

  it('is 0 for a missing component, no impacts, or no case', () => {
    const d = mk('A', 1, { components: [comp('Frame', [])] })
    expect(componentTotal(d, 'Frame')).toBe(0)
    expect(componentTotal(d, 'Wheels')).toBe(0)
    expect(componentTotal(undefined, 'Frame')).toBe(0)
  })
})

describe('buildComponentDiffRows', () => {
  it('gives each case value and its % change vs the baseline', () => {
    const base = mk('Base', 1, { components: [comp('Frame', [10]), comp('Paint', [0])] })
    const b = mk('B', 1, { components: [comp('Frame', [5]), comp('Paint', [3])] })
    const c = mk('C', 1, { components: [comp('Wheels', [2])] })
    expect(buildComponentDiffRows([base, b, c], ['Frame', 'Paint', 'Wheels'], base)).toEqual([
      {
        name: 'Frame',
        cells: [
          { caseId: 'id-Base', value: 10, delta: null },
          { caseId: 'id-B', value: 5, delta: -50 },
          { caseId: 'id-C', value: 0, delta: -100 },
        ],
      },
      {
        // A zero baseline gives no delta.
        name: 'Paint',
        cells: [
          { caseId: 'id-Base', value: 0, delta: null },
          { caseId: 'id-B', value: 3, delta: null },
          { caseId: 'id-C', value: 0, delta: null },
        ],
      },
      {
        name: 'Wheels',
        cells: [
          { caseId: 'id-Base', value: 0, delta: null },
          { caseId: 'id-B', value: 0, delta: null },
          { caseId: 'id-C', value: 2, delta: null },
        ],
      },
    ])
  })

  it('divides by the magnitude of a credit baseline', () => {
    const base = mk('Base', 1, { components: [comp('Recycling', [-10])] })
    const b = mk('B', 1, { components: [comp('Recycling', [-5])] })
    const [row] = buildComponentDiffRows([base, b], ['Recycling'], base)
    // Less credit = worse: positive change.
    expect(row.cells[1].delta).toBeCloseTo(50)
  })

  it('is empty without components', () => {
    expect(buildComponentDiffRows([mk('A', 1)], [], undefined)).toEqual([])
  })
})

describe('shortCaseName', () => {
  it('keeps the first word', () => {
    expect(shortCaseName('Steel frame v2')).toBe('Steel')
    expect(shortCaseName('Alu')).toBe('Alu')
    expect(shortCaseName('')).toBe('')
    expect(shortCaseName(' leading')).toBe('')
  })
})

describe('deriveAnalytics', () => {
  it('derives empty views without cases', () => {
    expect(deriveAnalytics([])).toEqual({
      baseCase: undefined,
      hasRealData: false,
      barGroups: [],
      barSeriesLabels: [],
      allComponentNames: [],
      bestComparison: null,
    })
  })

  it('keeps the first five categories for the grouped charts', () => {
    const a = mk('A', 10, {
      categories: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((n, i) => cat(n, i)),
      components: [comp('Frame', [1])],
    })
    const b = mk('B', 5)
    const derived = deriveAnalytics([a, b])
    expect(derived.baseCase).toBe(a)
    expect(derived.hasRealData).toBe(true)
    expect(derived.barGroups.map((g) => g.label)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5'])
    expect(derived.barGroups[1].values).toEqual([1, 0])
    expect(derived.barSeriesLabels).toEqual(['A', 'B'])
    expect(derived.allComponentNames).toEqual(['Frame'])
    expect(derived.bestComparison?.best).toBe(b)
    expect(derived.bestComparison?.deltaPct).toBeCloseTo(50)
  })

  it('returns new arrays on every call', () => {
    const data = [mk('A', 1, { categories: [cat('GWP', 1)] })]
    const first = deriveAnalytics(data)
    const second = deriveAnalytics(data)
    expect(second.barGroups).not.toBe(first.barGroups)
    expect(second.barSeriesLabels).not.toBe(first.barSeriesLabels)
    expect(second.allComponentNames).not.toBe(first.allComponentNames)
  })
})
