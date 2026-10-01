import { describe, it, expect } from 'vitest'

import { docsHint, mergeProjectStatus, projectCasesFrom } from '@/lib/import/project-status'

describe('projectCasesFrom', () => {
  it('reads case_id / case_name, falling back to id / name', () => {
    expect(
      projectCasesFrom({ cases: [{ case_id: 1, case_name: 'A', extra: true }, { id: 2, name: 'B' }] }),
    ).toEqual([
      { case_id: 1, case_name: 'A' },
      { case_id: 2, case_name: 'B' },
    ])
  })

  it('is null when there is no cases array, and [] for an empty one', () => {
    expect(projectCasesFrom({})).toBeNull()
    expect(projectCasesFrom(null)).toBeNull()
    expect(projectCasesFrom({ cases: 'x' })).toBeNull()
    expect(projectCasesFrom({ cases: [] })).toEqual([])
  })
})

describe('mergeProjectStatus', () => {
  it('unions present layers and drops a missing layer any case already has', () => {
    const status = mergeProjectStatus([
      {
        present: ['skeleton'],
        missing: [
          { layer: 'materials', label: 'Material inputs', suggestedDocs: ['Bill of materials (BOM)'] },
          { layer: 'energy', label: 'Energy inputs', suggestedDocs: [] },
        ],
      },
      { present: ['energy', 'skeleton'], missing: [{ layer: 'transport', label: 'Transport legs' }] },
    ])
    expect(status).toEqual({
      present: ['skeleton', 'energy'],
      missing: [
        { layer: 'materials', label: 'Material inputs', docs: ['Bill of materials (BOM)'] },
        { layer: 'transport', label: 'Transport legs', docs: [] },
      ],
    })
  })

  it('lets the last report naming a missing layer win, in first-seen order', () => {
    const status = mergeProjectStatus([
      { missing: [{ layer: 'costs', label: 'Costs (1)', suggestedDocs: ['A'] }, { layer: 'energy', label: 'E' }] },
      { missing: [{ layer: 'costs', label: 'Costs (2)', suggestedDocs: ['B'] }] },
    ])
    expect(status.missing).toEqual([
      { layer: 'costs', label: 'Costs (2)', docs: ['B'] },
      { layer: 'energy', label: 'E', docs: [] },
    ])
  })

  it('skips empty reports and is empty for none', () => {
    expect(mergeProjectStatus([])).toEqual({ present: [], missing: [] })
    expect(mergeProjectStatus([null, undefined, {}])).toEqual({ present: [], missing: [] })
  })

  it('keeps what a malformed report gave before it failed, and goes on', () => {
    const status = mergeProjectStatus([
      { present: ['skeleton'], missing: [{ layer: 'energy', label: 'E' }, null, { layer: 'costs', label: 'C' }] },
      { present: ['costs'] },
    ])
    expect(status).toEqual({ present: ['skeleton', 'costs'], missing: [{ layer: 'energy', label: 'E', docs: [] }] })
  })
})

describe('docsHint', () => {
  it('names the documents in parentheses, or nothing', () => {
    expect(docsHint(['BOM', 'Equipment list'])).toBe(' (BOM or Equipment list)')
    expect(docsHint(['BOM'])).toBe(' (BOM)')
    expect(docsHint([])).toBe('')
  })
})
