import { describe, expect, it } from 'vitest'
import { caseSteps, nextCaseStep, type CaseStepsInput } from '@/lib/workspace/case-steps'

const fresh: CaseStepsInput = {
  functionalUnit: null,
  referenceFlow: 1,
  canSetScope: true,
  stepCount: 0,
  flowCount: 0,
  countedFlows: 0,
  needsAmount: 0,
  leftOut: 0,
  runLabel: null,
  changedAfterRun: false,
  hasWriteUp: false,
  assignment: false,
  handedIn: false,
}
const keys = (i: CaseStepsInput) => caseSteps(i).map((s) => s.key)
const next = (i: CaseStepsInput) => nextCaseStep(caseSteps(i))?.action ?? null

describe('the step bar', () => {
  it('follows the ISO phases, with Hand in only on an assignment case', () => {
    expect(keys(fresh)).toEqual(['scope', 'inventory', 'impact', 'interpretation'])
    expect(keys({ ...fresh, assignment: true })).toEqual(['scope', 'inventory', 'impact', 'interpretation', 'handin'])
  })

  it('moves on as a student builds the case', () => {
    expect(next(fresh)).toBe('Set the functional unit')
    const scoped = { ...fresh, functionalUnit: 'One painted steel bracket' }
    expect(next(scoped)).toBe('Add the first step')
    expect(next({ ...scoped, stepCount: 4 })).toBe('Add a flow')
    expect(next({ ...scoped, stepCount: 4, flowCount: 3, countedFlows: 1, needsAmount: 2 })).toBe('Give every flow an amount')
    const counted = { ...scoped, stepCount: 4, flowCount: 3, countedFlows: 3 }
    expect(next(counted)).toBe('Run the case')
    expect(next({ ...counted, runLabel: 'Run 1' })).toBe('Write the interpretation')
    expect(next({ ...counted, runLabel: 'Run 1', changedAfterRun: true })).toBe('Run it again')
    expect(next({ ...counted, runLabel: 'Run 1', hasWriteUp: true })).toBeNull()
    expect(next({ ...counted, runLabel: 'Run 1', hasWriteUp: true, assignment: true })).toBe('Hand it in')
    expect(next({ ...counted, runLabel: 'Run 1', hasWriteUp: true, assignment: true, handedIn: true })).toBeNull()
  })

  it('a student who cannot set the scope is told the instructor sets it, and is sent on to the inventory', () => {
    const s = caseSteps({ ...fresh, canSetScope: false })
    expect(s[0]).toMatchObject({ done: false, detail: 'Your instructor sets the functional unit', action: null })
    expect(nextCaseStep(s)?.key).toBe('inventory')
  })

  it('says where each step stands', () => {
    const s = caseSteps({ ...fresh, functionalUnit: 'One bracket', stepCount: 1, flowCount: 1, countedFlows: 1, runLabel: 'Run 2', changedAfterRun: true })
    expect(s.map((x) => x.detail)).toEqual(['Per One bracket', '1 flow on 1 step', 'Changed since Run 2', 'Say what the result means'])
  })
})
