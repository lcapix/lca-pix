import { describe, expect, it } from 'vitest'
import { defaultCaseName, fromLine, isStudentHome, ownCase, ownerPossessive, sharedLine, staffCases } from '@/lib/home/student-view'
import type { HomeProject } from '@/lib/home/home-view'

const p = (o: Partial<HomeProject>): HomeProject => ({
  project_id: 1,
  project_name: 'Steel bracket · LCA 301',
  owner_id: 2,
  permission_name: 'editor',
  is_sample: false,
  case_count: 34,
  member_count: 30,
  people: 31,
  hand_ins: 0,
  held_lines: 0,
  held_case: null,
  member_cases_without_run: 0,
  base_case_id: null,
  base_run: null,
  base_changed_after_run: null,
  ...o,
})
const run = (value: number) => ({ run_id: 1, headline: { value, unit: 'kg CO2 eq' } })

describe('student Home', () => {
  it('is for someone with shared projects and none they run', () => {
    expect(isStudentHome([p({}), p({ project_id: 9, is_sample: true, owner_id: 7 })], 7)).toBe(true)
    expect(isStudentHome([p({}), p({ project_id: 3, owner_id: 7 })], 7)).toBe(false)
    expect(isStudentHome([p({ permission_name: 'admin' })], 7)).toBe(false)
    expect(isStudentHome([p({ is_sample: true, owner_id: 7 })], 7)).toBe(false)
  })

  it('words the header, the card line and the names', () => {
    expect(sharedLine(1, 'Canvas')).toBe('1 project shared with you · deadlines and grades stay in Canvas')
    expect(sharedLine(2, null)).toBe('2 projects shared with you')
    expect(fromLine({ owner: 'Dr. Elena Rivera', role: 'editor', fu: '1 bracket', method: 'TRACI 2.1', region: 'US' })).toBe('From Dr. Elena Rivera · you can change · 1 bracket · TRACI 2.1 · US')
    expect(fromLine({ owner: null, role: 'viewer', fu: null, method: null, region: null })).toBe('you can read')
    expect(ownerPossessive('Dr. Elena Rivera')).toBe("Dr. Rivera's")
    expect(ownerPossessive('Elena Rivera')).toBe("Elena's")
    expect(defaultCaseName('Noah Kim')).toBe("Noah's case")
    expect(defaultCaseName(null)).toBe('My case')
  })

  it("lists the owner's cases with answers and a copy's change, and finds your own case", () => {
    const cases = [
      { case_id: 5, case_name: 'Shorter cure cycle', case_type: 'comparative', created_by: 2, latest_run: run(1.667455) },
      { case_id: 4, case_name: 'Base case', case_type: 'base', created_by: 2, latest_run: run(1.719955) },
      { case_id: 8, case_name: "Ana's case", case_type: 'comparative', created_by: 7, is_final: true, latest_run: run(1.682) },
      { case_id: 9, case_name: "Ana's draft", case_type: 'comparative', created_by: 7, latest_run: null },
    ]
    expect(staffCases(cases, new Set([2])).map((c) => [c.case_name, c.answer, c.change])).toEqual([
      ['Base case', '1.72', null],
      ['Shorter cure cycle', '1.667', '3.1% lower'],
    ])
    expect(ownCase(cases, 7)?.case_name).toBe("Ana's case")
    expect(ownCase(cases, 3)).toBeNull()
  })
})
