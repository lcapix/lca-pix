import { describe, it, expect } from 'vitest'
import {
  buildAbsoluteChartData,
  buildComponentBreakdownRows,
  buildDeltaChartData,
  buildLogChartData,
  buildNormalizedChartData,
  buildRadarChartData,
  defaultCategoryView,
  formatLogTick,
  formatSignedPercent,
} from '@/lib/analytics/chart-data'
import { EMPTY_COSTS } from '@/lib/analytics/constants'
import type { AssessmentData, BarGroup } from '@/lib/analytics/types'

const groups: BarGroup[] = [
  { label: 'GWP', values: [10, -5] },
  { label: 'AP', values: [0, 0] },
]
const labels = ['Steel', 'Alu']

describe('defaultCategoryView', () => {
  it('opens on Absolute for one scenario, Radar for several', () => {
    expect(defaultCategoryView(0)).toBe('absolute')
    expect(defaultCategoryView(1)).toBe('absolute')
    expect(defaultCategoryView(2)).toBe('radar')
    expect(defaultCategoryView(5)).toBe('radar')
  })
})

describe('buildAbsoluteChartData', () => {
  it('plots raw values, signs kept, with a raw copy for the tooltip', () => {
    expect(buildAbsoluteChartData(groups, labels)).toEqual([
      { category: 'GWP', Steel: 10, Steel__raw: 10, Alu: -5, Alu__raw: -5 },
      { category: 'AP', Steel: 0, Steel__raw: 0, Alu: 0, Alu__raw: 0 },
    ])
  })

  it('is empty without groups and has only the label without series', () => {
    expect(buildAbsoluteChartData([], labels)).toEqual([])
    expect(buildAbsoluteChartData(groups, [])).toEqual([{ category: 'GWP' }, { category: 'AP' }])
  })

  it('carries undefined for a series beyond the group values', () => {
    const [point] = buildAbsoluteChartData([{ label: 'GWP', values: [1] }], ['A', 'B'])
    expect(point.B).toBeUndefined()
    expect('B' in point).toBe(true)
  })
})

describe('buildNormalizedChartData / buildRadarChartData', () => {
  it('scales to the largest magnitude, a credit stays negative', () => {
    const expected = [
      { category: 'GWP', Steel: 100, Steel__raw: 10, Alu: -50, Alu__raw: -5 },
      { category: 'AP', Steel: 0, Steel__raw: 0, Alu: 0, Alu__raw: 0 },
    ]
    expect(buildNormalizedChartData(groups, labels)).toEqual(expected)
    expect(buildRadarChartData(groups, labels)).toEqual(expected)
  })

  it('returns a fresh array per call', () => {
    expect(buildRadarChartData(groups, labels)).not.toBe(buildRadarChartData(groups, labels))
  })
})

describe('buildLogChartData', () => {
  it('plots signed log10(|v| + 1), raw value kept', () => {
    const [gwp, ap] = buildLogChartData([{ label: 'GWP', values: [99, -9] }, groups[1]], labels)
    expect(gwp.Steel).toBeCloseTo(2)
    expect(gwp.Alu).toBeCloseTo(-1)
    expect(gwp.Steel__raw).toBe(99)
    expect(gwp.Alu__raw).toBe(-9)
    expect(ap).toEqual({ category: 'AP', Steel: 0, Steel__raw: 0, Alu: 0, Alu__raw: 0 })
  })
})

describe('formatLogTick', () => {
  it('formats the exponent with one decimal and the sign in front', () => {
    expect(formatLogTick(2)).toBe('10^2.0')
    expect(formatLogTick(-1.55)).toBe('-10^1.6')
    expect(formatLogTick(0)).toBe('10^0.0')
  })
})

describe('buildDeltaChartData', () => {
  it('gives each non-baseline series its % change vs the baseline', () => {
    expect(
      buildDeltaChartData(
        [
          { label: 'GWP', values: [10, 5, 15] },
          { label: 'AP', values: [-10, -5, -20] },
        ],
        ['B', 'C'],
      ),
    ).toEqual([
      { category: 'GWP', B: -50, C: 50 },
      // Relative to the magnitude of a credit baseline.
      { category: 'AP', B: 50, C: -100 },
    ])
  })

  it('gives 0 for a zero, missing or NaN baseline', () => {
    expect(
      buildDeltaChartData(
        [
          { label: 'Z', values: [0, 5] },
          { label: 'M', values: [] },
          { label: 'N', values: [NaN, 5] },
        ],
        ['B'],
      ),
    ).toEqual([
      { category: 'Z', B: 0 },
      { category: 'M', B: 0 },
      { category: 'N', B: 0 },
    ])
  })

  it('reads a missing comparison value as 0', () => {
    expect(buildDeltaChartData([{ label: 'GWP', values: [4] }], ['B'])).toEqual([
      { category: 'GWP', B: -100 },
    ])
  })

  it('has only labels without other series', () => {
    expect(buildDeltaChartData(groups, [])).toEqual([{ category: 'GWP' }, { category: 'AP' }])
  })
})

describe('formatSignedPercent', () => {
  it('prefixes + for a positive value only', () => {
    expect(formatSignedPercent(12.34, 1)).toBe('+12.3%')
    expect(formatSignedPercent(-5, 0)).toBe('-5%')
    expect(formatSignedPercent(0, 0)).toBe('0%')
    expect(formatSignedPercent(0.04, 0)).toBe('+0%')
  })
})

describe('buildComponentBreakdownRows', () => {
  const mk = (caseName: string, components: AssessmentData['components']): AssessmentData => ({
    caseId: caseName,
    caseName,
    caseType: 'base',
    categories: [],
    components,
    totalScore: 0,
    costs: { ...EMPTY_COSTS },
  })

  it('sums each component per scenario, 0 when missing, signs kept', () => {
    const a = mk('A', [
      {
        component_name: 'Frame',
        component_type: 'product',
        impacts: [
          { category_name: 'GWP', impact_value: 10 },
          { category_name: 'AP', impact_value: 1 },
        ],
      },
      {
        component_name: 'Recycling',
        component_type: 'operation',
        impacts: [{ category_name: 'GWP', impact_value: -4 }],
      },
    ])
    const b = mk('B', [])
    expect(buildComponentBreakdownRows([a, b], ['Frame', 'Recycling'])).toEqual([
      { scenario: 'A', Frame: 11, Recycling: -4 },
      { scenario: 'B', Frame: 0, Recycling: 0 },
    ])
  })

  it('is empty without cases', () => {
    expect(buildComponentBreakdownRows([], ['Frame'])).toEqual([])
  })
})
