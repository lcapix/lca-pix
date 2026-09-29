import { describe, expect, it } from 'vitest'

import {
  boundaryGaps,
  groupByStage,
  stageLabel,
  stageOf,
  stagesInBoundary,
} from '@/lib/life-cycle'

describe('life-cycle stages', () => {
  it('reads a step with no stage as production, because every case built before stages is a plant model', () => {
    expect(stageOf(null)).toBe('production')
    expect(stageOf('')).toBe('production')
    expect(stageOf('nonsense')).toBe('production')
    expect(stageOf('USE')).toBe('use')
    expect(stageLabel(null)).toBe('Production')
    expect(stageLabel('end_of_life')).toBe('End of life')
  })

  it('maps a declared boundary to the stages it covers', () => {
    expect(stagesInBoundary('cradle-to-gate')).toEqual(['materials', 'production'])
    expect(stagesInBoundary('Cradle-to-grave (including use and end of life)')).toHaveLength(5)
    expect(stagesInBoundary('gate-to-gate')).toEqual(['production'])
  })

  it('names the stages a study claims but does not contain', () => {
    const present = [
      { stage: 'materials' as const, steps: 3, flows: 12 },
      { stage: 'production' as const, steps: 5, flows: 20 },
      { stage: 'use' as const, steps: 1, flows: 0 }, // a step exists, but nothing in it
    ]
    const gaps = boundaryGaps('cradle-to-grave', present)
    expect(gaps.missing).toEqual(['distribution', 'use', 'end_of_life'])
    expect(gaps.outside).toEqual([])
  })

  it('names a stage modelled outside the declared boundary', () => {
    const gaps = boundaryGaps('cradle-to-gate', [
      { stage: 'production', steps: 4, flows: 9 },
      { stage: 'end_of_life', steps: 1, flows: 2 },
    ])
    expect(gaps.outside).toEqual(['end_of_life'])
    expect(gaps.missing).toEqual(['materials'])
  })

  it('totals by stage in life-cycle order, with shares', () => {
    const rows = groupByStage([
      { stage: 'production', value: 20 },
      { stage: null, value: 5 }, // unlabelled: production
      { stage: 'materials', value: 75 },
    ])
    expect(rows.map((r) => r.stage)).toEqual(['materials', 'production'])
    expect(rows[0].value).toBe(75)
    expect(rows[1].value).toBe(25)
    expect(rows[0].share).toBeCloseTo(0.75, 6)
  })
})
