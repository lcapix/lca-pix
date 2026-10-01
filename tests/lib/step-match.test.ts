import { describe, expect, it } from 'vitest'

import { matchSteps, stepNumber, stepTitle, type ExistingStep } from '@/lib/ingest/step-match'

const existing: ExistingStep[] = [
  { component_id: 11, component_name: '10. Cut & miter frame tubes' },
  { component_id: 12, component_name: '40. MIG weld main triangle' },
  { component_id: 13, component_name: '70. Final assembly' },
]

describe('matching a document’s steps to a case’s steps', () => {
  it('reads a step number however the document writes it', () => {
    expect(stepNumber('70. Final assembly')).toBe('70')
    expect(stepNumber('Op 70 — assembly')).toBe('70')
    expect(stepNumber('070 assembly')).toBe('70')
    expect(stepNumber('Welding')).toBeNull()
    expect(stepTitle('70. Final assembly')).toBe('final assembly')
  })

  it('attaches on an exact name', () => {
    const [m] = matchSteps([{ name: '70. Final assembly' }], existing)
    expect(m).toMatchObject({ component_id: 13, reason: 'exact name', suggested: 'attach' })
  })

  it('attaches on the step number when the wording drifted', () => {
    const [m] = matchSteps([{ name: '70 Final assy' }], existing)
    expect(m).toMatchObject({ component_id: 13, reason: 'same step number', suggested: 'attach' })
  })

  it('proposes a match on the words when the numbering changed, and says so', () => {
    const [m] = matchSteps([{ name: '90. Final assembly' }], existing)
    expect(m).toMatchObject({ component_id: 13, reason: 'same name, different step number' })
  })

  it('suggests creating a step the case does not have', () => {
    const [m] = matchSteps([{ name: '55. Powder coat' }], existing)
    expect(m).toMatchObject({ component_id: null, reason: 'no match', suggested: 'create' })
  })

  it('attaches a second document’s root to the case’s product instead of making another one', () => {
    // A routing names its root after the file. Creating it would give the case
    // two product nodes, which is how "routing-v2" appeared in testing.
    const withRoot: ExistingStep[] = [
      { component_id: 1, component_name: 'Touring bike', parent_component_id: null },
      ...existing.map((e) => ({ ...e, parent_component_id: 1 })),
    ]
    const [root] = matchSteps([{ name: 'routing-v2', parent: null }], withRoot)
    expect(root).toMatchObject({ component_id: 1, suggested: 'attach' })
  })

  it('never matches two document steps to the same existing step', () => {
    // Two routings that both call a step 70 must not both land on component 13,
    // which is exactly how hours get doubled.
    const out = matchSteps([{ name: '70. Final assembly' }, { name: '70 Final assembly' }], existing)
    expect(out[0].component_id).toBe(13)
    expect(out[1].component_id).toBeNull()
    expect(out[1].suggested).toBe('create')
  })
})
