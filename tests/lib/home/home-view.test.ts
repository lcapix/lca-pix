import { describe, expect, it } from 'vitest'
import { continueNext, continueParts, countsLine, homeMode, needsAttention, projectMeta, type HomeProject } from '@/lib/home/home-view'

const ME = 7
const project = (o: Partial<HomeProject>): HomeProject => ({
  project_id: 1,
  project_name: 'Plated housing',
  owner_id: ME,
  permission_name: 'owner',
  case_count: 34,
  member_count: 31,
  people: 31,
  held_lines: 0,
  held_case: null,
  member_cases_without_run: 0,
  base_case_id: 11,
  base_run: { run_id: 301, run_date: '2026-10-01', headline: { category: 'Global Warming', value: 1.72, unit: 'kg CO2 eq' } },
  base_changed_after_run: false,
  ...o,
})
describe('Home (E12)', () => {
  it('which Home: nothing yet, or later', () => {
    expect(homeMode([])).toBe('empty')
    expect(homeMode([project({})])).toBe('later')
    expect(countsLine([project({}), project({ project_id: 2, owner_id: 3 })], ME)).toBe('1 project of yours · 1 shared with you')
    expect(projectMeta(project({}))).toBe('34 cases · 31 people')
    expect(projectMeta(project({ case_count: 1, people: 1 }))).toBe('1 case · just you')
  })

  it('needs attention: held lines, a base case changed after its run, member cases with no run', () => {
    const items = needsAttention(
      [
        project({ base_changed_after_run: true, member_cases_without_run: 9 }),
        project({ project_id: 2, project_name: 'Aluminium enclosure', held_lines: 3, held_case: { case_id: 21, case_name: 'Base case' }, base_run: null }),
        project({ project_id: 3, owner_id: 4, permission_name: 'editor', member_cases_without_run: 2 }),
      ],
      ME,
    )
    expect(items.map((i) => [i.title, i.where, i.action, i.href])).toEqual([
      ['3 lines held', 'Aluminium enclosure · Base case', 'Fix', '/project/2/case/21?tab=inventory'],
      ['Base case changed after Run #301', 'Plated housing', 'Run again', '/project/1/case/11'],
      ['9 member cases have no run yet', 'Plated housing', 'See cases', '/project/1/cases'],
    ])
  })

  it('Continue: four parts and the one next step', () => {
    const c = { steps: 5, flowsIn: 15, flowsTotal: 15, held: 3, needsAmount: 0, leftOut: 0, latestRunId: null, changedAfterRun: false, hasWriteUp: false }
    expect(continueParts(c).map((p) => p.label)).toEqual(['Tree · 5 steps', 'Inventory · 15 of 18', 'Results · no run', 'Write-up · not started'])
    expect(continueNext(c)).toEqual({ line: 'Next: give the 3 held lines a value, then run it.', tab: 'inventory', button: 'Open Inventory' })
    expect(continueNext({ ...c, held: 0 }).line).toBe('Next: run it.')
    expect(continueNext({ ...c, held: 0, latestRunId: 301, changedAfterRun: true }).line).toBe('Next: run it again. It changed after Run #301.')
    expect(continueNext({ ...c, held: 0, latestRunId: 301 })).toMatchObject({ tab: 'writeup' })
    expect(continueNext({ ...c, held: 0, needsAmount: 1 }).line).toBe('Next: give the flow an amount, then run it.')
    expect(continueNext({ ...c, held: 0, leftOut: 1 })).toEqual({
      line: 'Next: pick a unit that converts for the flow left out, then run it.',
      tab: 'inventory',
      button: 'Open Inventory',
    })
  })
})
