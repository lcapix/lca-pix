import { describe, it, expect } from 'vitest'
import { deriveCaseStatus } from '@/lib/case-editor/case-status'

const report = (present: string[], missing: Array<{ layer: string; label: string; suggestedDocs: string[] }> = []) => ({
  present,
  missing,
  score: 0,
})

describe('deriveCaseStatus', () => {
  it('blocked on the functional unit: set it first', () => {
    const v = deriveCaseStatus({ completeness: report(['materials']), goalScopeLoaded: true, fuMissing: true, canRun: false, hasAssessment: false })
    expect(v.status).toBe('blocked')
    expect(v.accent).toBe('#c0392b')
    expect(v.primary).toEqual({ action: 'set-functional-unit', label: 'Set functional unit', run: false })
  })

  it('blocked on an empty inventory: add inputs', () => {
    const v = deriveCaseStatus({ completeness: report(['skeleton']), goalScopeLoaded: true, fuMissing: false, canRun: false, hasAssessment: false })
    expect(v.primary.action).toBe('add-inputs')
    expect(v.primary.label).toBe('Add material inputs')
  })

  it('ready: run, and name the first missing layer and where it comes from', () => {
    const v = deriveCaseStatus({
      completeness: report(['skeleton', 'materials'], [
        { layer: 'energy', label: 'Energy', suggestedDocs: ['utility bill'] },
        { layer: 'transport', label: 'Transport', suggestedDocs: [] },
      ]),
      goalScopeLoaded: true,
      fuMissing: false,
      canRun: true,
      hasAssessment: false,
    })
    expect(v.status).toBe('ready')
    expect(v.primary).toEqual({ action: 'run', label: 'Run assessment', run: true })
    expect(v.missingPhrase).toBe('Energy (from a utility bill)')
    expect(v.accent).toBe('var(--signal-info, #2563eb)')
  })

  it('assessed: view results; a missing layer with no document is entered by hand', () => {
    const v = deriveCaseStatus({
      completeness: report(['materials'], [{ layer: 'transport', label: 'Transport', suggestedDocs: [] }]),
      goalScopeLoaded: true,
      fuMissing: false,
      canRun: true,
      hasAssessment: true,
    })
    expect(v.status).toBe('assessed')
    expect(v.primary.action).toBe('view-results')
    expect(v.missingPhrase).toBe('Transport (enter it by hand on the step that uses it)')
    expect(v.phases.map((p) => p.label)).toEqual(['Goal & scope', 'Inventory', 'Impact', 'Interpretation', 'Report'])
  })

  it('labels the layers already added', () => {
    const v = deriveCaseStatus({ completeness: report(['materials', 'mystery']), goalScopeLoaded: false, fuMissing: false, canRun: true, hasAssessment: false })
    expect(v.addedLabels[1]).toBe('mystery')
    expect(v.missingPhrase).toBeNull()
  })
})
