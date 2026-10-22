import { describe, expect, it } from 'vitest'
import { PIPELINE_LABEL, headlineOf, pipelineStage } from '@/lib/summary/case-summary'

describe("E07's pipeline stage", () => {
  it('reads what exists: no run, a run, a write-up, a hand-in tick', () => {
    expect(pipelineStage({ completedRuns: 0, hasInterpretation: false, isFinal: false })).toBe('not_run')
    expect(pipelineStage({ completedRuns: 0, hasInterpretation: true, isFinal: false })).toBe('not_run')
    expect(pipelineStage({ completedRuns: 2, hasInterpretation: false, isFinal: false })).toBe('run')
    expect(pipelineStage({ completedRuns: 1, hasInterpretation: true, isFinal: false })).toBe('written')
    // The tick locks nothing and is shown as ticked whatever else exists.
    expect(pipelineStage({ completedRuns: 0, hasInterpretation: false, isFinal: true })).toBe('handed_in')
    expect(PIPELINE_LABEL.handed_in).toBe('Ticked as hand-in')
  })
})

describe('headlineOf', () => {
  const totals = [
    { category_name: 'Acidification', value: 0.007, unit: 'kg SO2 eq' },
    { category_name: 'Global Warming', value: 3.44, unit: 'kg CO2 eq' },
  ]
  it('picks global warming and scales it per functional unit (3.44 over 2 brackets = 1.72)', () => {
    expect(headlineOf(totals, 0.5)).toEqual({ category: 'Global Warming', value: 1.72, unit: 'kg CO2 eq' })
    expect(headlineOf(JSON.stringify(totals), '0.5')?.value).toBe(1.72)
  })
  it('falls back to the first category, a scale of 1, and null for a run with no totals', () => {
    expect(headlineOf([totals[0]], null)).toEqual({ category: 'Acidification', value: 0.007, unit: 'kg SO2 eq' })
    expect(headlineOf(totals, 0)?.value).toBe(3.44)
    expect(headlineOf(null, 1)).toBeNull()
    expect(headlineOf([], 1)).toBeNull()
    expect(headlineOf('not json', 1)).toBeNull()
  })
})
