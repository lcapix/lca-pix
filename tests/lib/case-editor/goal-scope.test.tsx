import { describe, it, expect } from 'vitest'

import { fmtScale, goalScopeFromApi, goalScopeSave, positiveString, toGoalScopeSummary } from '@/lib/case-editor/goal-scope'

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as any
const PROJECT = { functional_unit: '1 bracket', system_boundary: 'gate-to-gate', goal_statement: 'Compare blanks', boundary_notes: '' }
const CASE = { reference_flow: '1.000000', reference_flow_unit: 'bracket', modeled_output: '0' }

describe('goal & scope data', () => {
  it('reads the project and case fields, defaulting bad numbers to 1', () => {
    expect(goalScopeFromApi(PROJECT, CASE)).toEqual({
      goalStatement: 'Compare blanks',
      functionalUnit: '1 bracket',
      systemBoundary: 'gate-to-gate',
      boundaryNotes: '',
      referenceFlow: '1',
      referenceFlowUnit: 'bracket',
      modeledOutput: '1',
    })
    expect(goalScopeFromApi({}, CASE)).toBeNull()
    expect(goalScopeFromApi(PROJECT, {})).toBeNull()
    expect(positiveString('-3')).toBe('1')
    expect(positiveString('2.50')).toBe('2.5')
  })

  it('summarises for the run gate and formats the scale', () => {
    expect(toGoalScopeSummary({ ...goalScopeFromApi(PROJECT, CASE)!, functionalUnit: ' 1 bracket ', referenceFlow: '' })).toMatchObject({
      functionalUnit: '1 bracket',
      referenceFlow: 1,
    })
    expect(fmtScale(1)).toBe('1')
    expect(fmtScale(1 / 15)).toBe('0.0667')
    expect(fmtScale(Infinity)).toBe('?')
  })

  it('refuses a reference flow or data basis that is not above 0, and trims what it sends', () => {
    const f = goalScopeFromApi(PROJECT, CASE)!
    expect(goalScopeSave({ ...f, modeledOutput: '0' })).toEqual({ ok: false, error: 'Reference flow and data basis must be numbers above 0.' })
    const plan = goalScopeSave({ ...f, functionalUnit: ' 1 bracket ', referenceFlow: '2', modeledOutput: '4' })
    expect(plan.ok && plan.project).toEqual({ functional_unit: '1 bracket', system_boundary: 'gate-to-gate', goal_statement: 'Compare blanks', boundary_notes: '' })
    expect(plan.ok && plan.case).toEqual({ reference_flow: 2, reference_flow_unit: 'bracket', modeled_output: 4 })
  })
})
