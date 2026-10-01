import { describe, it, expect } from 'vitest'
import { completedAssessments, summarizeRunResults, DEFAULT_IMPACT_UNIT } from '@/lib/project/case-impact'

describe('completedAssessments', () => {
  it('keeps completed runs and older rows with no status, drops failed and running ones', () => {
    const runs = [
      { run_id: 1, status: 'completed' },
      { run_id: 2, status: 'failed' },
      { run_id: 3 },
      { run_id: 4, status: null },
      { run_id: 5, status: 'running' },
    ]
    expect(completedAssessments(runs).map((r) => r.run_id)).toEqual([1, 3, 4])
  })

  it('is empty for no runs', () => {
    expect(completedAssessments([])).toEqual([])
  })
})

describe('summarizeRunResults', () => {
  it('uses the global-warming rows only, never a sum across categories', () => {
    const s = summarizeRunResults([
      { category_name: 'Acidification', unit: 'kg SO2-eq', impact_value: '9', component_name: 'Frame' },
      { category_name: 'Global Warming', unit: 'kg CO2-eq', impact_value: '12.5', component_name: 'Frame' },
      { category_name: 'Global Warming', unit: 'kg CO2-eq', impact_value: '2.5', component_name: 'Paint' },
    ])
    expect(s.total).toBe(15)
    expect(s.unit).toBe('kg CO2-eq')
    expect(s.categoryCount).toBe(2)
    expect(s.impactByComponent).toEqual({ Frame: 12.5, Paint: 2.5 })
    expect(s.contributors).toEqual([
      { name: 'Frame', value: 12.5, pct: (12.5 / 15) * 100 },
      { name: 'Paint', value: 2.5, pct: (2.5 / 15) * 100 },
    ])
  })

  it('matches "climate" too, case-insensitively', () => {
    const s = summarizeRunResults([
      { category_name: 'Climate change', unit: 'kg CO2 eq', impact_value: 3, component_name: 'A' },
      { category_name: 'Ozone depletion', unit: 'kg CFC-11', impact_value: 1, component_name: 'A' },
    ])
    expect(s.total).toBe(3)
    expect(s.unit).toBe('kg CO2 eq')
  })

  it('falls back to the first category when there is no global-warming row', () => {
    const s = summarizeRunResults([
      { category_name: 'Ozone depletion', unit: 'kg CFC-11-eq', impact_value: 1, component_name: 'A' },
      { category_name: 'Acidification', unit: 'kg SO2-eq', impact_value: 5, component_name: 'A' },
      { category_name: 'Ozone depletion', unit: 'kg CFC-11-eq', impact_value: 2, component_name: 'B' },
    ])
    expect(s.total).toBe(3)
    expect(s.unit).toBe('kg CFC-11-eq')
    expect(s.contributors.map((c) => c.name)).toEqual(['B', 'A'])
  })

  it('sums rows of the same component and names unnamed ones by id', () => {
    const s = summarizeRunResults([
      { category_name: 'Global warming', impact_value: 1, component_name: 'Weld' },
      { category_name: 'Global warming', impact_value: 2, component_name: 'Weld' },
      { category_name: 'Global warming', impact_value: 4, component_id: 9 },
    ])
    expect(s.impactByComponent).toEqual({ Weld: 3, '#9': 4 })
    expect(s.unit).toBe(DEFAULT_IMPACT_UNIT)
  })

  it('keeps the five largest contributors, largest first', () => {
    const rows = [1, 7, 3, 9, 5, 2].map((v, i) => ({
      category_name: 'Global warming',
      impact_value: v,
      component_name: `C${i}`,
    }))
    const s = summarizeRunResults(rows)
    expect(s.contributors.map((c) => c.value)).toEqual([9, 7, 5, 3, 2])
    expect(Object.keys(s.impactByComponent)).toHaveLength(6)
  })

  it('gives every contributor a 0 % share when the total is not positive', () => {
    const s = summarizeRunResults([
      { category_name: 'Global warming', impact_value: -2, component_name: 'Credit' },
      { category_name: 'Global warming', impact_value: 1, component_name: 'Burden' },
    ])
    expect(s.total).toBe(-1)
    expect(s.contributors).toEqual([
      { name: 'Burden', value: 1, pct: 0 },
      { name: 'Credit', value: -2, pct: 0 },
    ])
  })

  it('treats missing or empty values as 0 and an empty run as nothing', () => {
    expect(
      summarizeRunResults([{ category_name: 'Global warming', impact_value: null, component_name: 'A' }]).total,
    ).toBe(0)
    const empty = summarizeRunResults([])
    expect(empty).toEqual({
      total: 0,
      unit: DEFAULT_IMPACT_UNIT,
      contributors: [],
      impactByComponent: {},
      categoryCount: 0,
    })
  })
})
