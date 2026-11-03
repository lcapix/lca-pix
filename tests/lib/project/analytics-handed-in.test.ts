/**
 * Analytics counts a hand-in once (journey review): the frozen copy is not a
 * case of its own nor a second dot; its working case counts as handed in.
 */
import { describe, expect, it } from 'vitest'
import { classCounts, handedInIds, landed, landedLine, studentCases, type ClassCase } from '@/lib/project/analytics-view'

const run = (v: number) => ({ run_id: 1, method: 'TRACI 2.1', region: 'US', headline: { value: v, unit: 'kg CO2 eq' } })
const c = (o: Partial<ClassCase> & { case_id: number }): ClassCase => ({ case_name: `c${o.case_id}`, case_type: 'comparative', created_by: 3, author: 'Sam Student', has_interpretation: false, is_final: false, latest_run: null, ...o })
const cases = [
  c({ case_id: 6, created_by: 2, case_type: 'base', latest_run: run(88.4167) }),
  c({ case_id: 7, has_interpretation: true, latest_run: run(86.699), assignment_id: 1 }),
  c({ case_id: 8, read_only: true, assignment_id: 1, handed_in: true, working_case_id: 7, latest_run: run(86.699) }),
  c({ case_id: 9 }),
]

describe('Analytics and hand-ins', () => {
  const students = studentCases(cases, new Set([2]))
  const handed = handedInIds(cases)

  it('the hand-in copy is not a student case; its working case is handed in', () => {
    expect(students.map((x) => x.case_id)).toEqual([7, 9])
    expect(classCounts(students, handed)).toEqual({ cases: 2, ran: 1, wrote: 1, ticked: 1, notRun: 1 })
  })

  it('one dot per student, and the line reads at 3 significant figures', () => {
    const { dots } = landed(students, { method: 'TRACI 2.1', region: 'US' }, handed)
    expect(dots.map((d) => [d.case_id, d.ticked])).toEqual([[7, true]])
    expect(landedLine(dots, 88.4167)).toBe('1 run, at 86.7. The base case is 88.4.')
  })
})
