import { describe, it, expect } from 'vitest'
import {
  assessmentCompleteMessage,
  buildRunBody,
  completedRuns,
  hasRunSibling,
  isInventoryReady,
  readRunPrefs,
  runBlockedMessage,
  runButtonTitle,
  topClimateStep,
} from '@/lib/case-editor/run-assessment'

describe('run gate', () => {
  it('is ready until a report says no impact-bearing layer is present', () => {
    expect(isInventoryReady(null)).toBe(true)
    expect(isInventoryReady({ present: ['skeleton', 'costs'], missing: [], score: 0 })).toBe(false)
    expect(isInventoryReady({ present: ['skeleton', 'transport'], missing: [], score: 0 })).toBe(true)
  })

  it('explains why a run is blocked', () => {
    expect(runBlockedMessage(true)).toMatch(/^Set the functional unit first/)
    expect(runBlockedMessage(false)).toMatch(/^Nothing to assess yet/)
    expect(runButtonTitle(true, false)).toBe('Set the functional unit (Goal & scope) before running')
    expect(runButtonTitle(false, false)).toBe('Add at least one input or emission before running')
    expect(runButtonTitle(false, true)).toBeUndefined()
  })
})

describe('run prefs and body', () => {
  const storage = (v: string | null) => ({ getItem: () => v })
  it('reads the method/region the run modal remembered, ignoring corrupt prefs', () => {
    expect(readRunPrefs('10', storage('{"method":"TRACI 2.1","region":"US"}'))).toEqual({ method: 'TRACI 2.1', region: 'US' })
    expect(readRunPrefs('10', storage(null))).toEqual({})
    expect(readRunPrefs('10', storage('{oops'))).toEqual({})
  })
  it('sends only what was remembered', () => {
    expect(buildRunBody({})).toEqual({ run_name: 'Assessment' })
    expect(buildRunBody({ method: 'CML 2001', region: 'EU' })).toEqual({
      run_name: 'Assessment',
      calculation_method: 'CML 2001',
      region_code: 'EU',
    })
  })
})

describe('assessmentCompleteMessage', () => {
  it('quotes the global-warming total when there is one', () => {
    expect(
      assessmentCompleteMessage({ total_impacts: [{ category_name: 'Global Warming', impact_value: 1.7234 }] }),
    ).toBe('Assessment complete — 1.723 kg CO₂-eq')
    expect(assessmentCompleteMessage({})).toBe('Assessment complete')
    expect(assessmentCompleteMessage(null)).toBe('Assessment complete')
  })
})

describe('past runs', () => {
  const run = (impacts: Record<string, number>, components: any[] = [], status?: string) => ({ status, impacts, components })

  it('counts completed runs with results only', () => {
    expect(completedRuns([run({}), run({ 'Global Warming': 1 }, [], 'failed'), run({ 'Global Warming': 1 })])).toHaveLength(1)
    expect(completedRuns(undefined)).toEqual([])
  })

  it('names the step with the most climate impact', () => {
    const r = run({ 'Global Warming': 3 }, [
      { component_name: 'Cut', impacts: { 'Global Warming': 1 } },
      { component_name: 'Paint', impacts: { 'Global Warming': 2 } },
      { component_name: 'Idle', impacts: { 'Global Warming': 0 } },
    ])
    expect(topClimateStep(r)).toBe('Paint')
    expect(topClimateStep(run({ 'Climate change': 1 }, [{ component_name: 'X', impacts: {} }]))).toBeNull()
    expect(topClimateStep(run({ Acidification: 1 }))).toBeUndefined()
    expect(topClimateStep(undefined)).toBeUndefined()
  })

  it('sees a sibling case that has been run', () => {
    expect(hasRunSibling([{ case_id: 10, run_count: 3 }, { case_id: 11, run_count: 0 }], '10')).toBe(false)
    expect(hasRunSibling([{ case_id: 10, run_count: 0 }, { case_id: 11, run_count: '1' }], '10')).toBe(true)
    expect(hasRunSibling(undefined, '10')).toBe(false)
  })
})
