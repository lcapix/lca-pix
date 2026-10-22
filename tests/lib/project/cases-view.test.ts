import { describe, expect, it } from 'vitest'
import { answerOf, casesHeader, changeVsBase, matchesSearch, splitCases } from '@/lib/project/cases-view'

const run = (id: number, value: number) => ({ run_id: id, headline: { value, unit: 'kg CO2 eq' } })
const base = { case_id: 1, case_name: 'Base case', case_type: 'base', created_by: 9, author: 'Elena Rivera', latest_run: run(301, 1.7196) }
const whatIf = { case_id: 2, case_name: 'Shorter cure cycle', case_type: 'comparative', created_by: 9, author: 'Elena Rivera', latest_run: run(302, 1.6674667) }
const ana = { case_id: 3, case_name: "Ana's case", case_type: 'comparative', created_by: 20, author: 'Ana Ruiz', latest_run: run(214, 1.682) }
const sam = { case_id: 4, case_name: "Sam's case", case_type: 'comparative', created_by: 21, author: 'Sam Ortiz', latest_run: null }

describe('Cases (E07)', () => {
  it("yours and the members', the header, the answers and the change against the Base case", () => {
    const { mine, others } = splitCases([base, whatIf, ana, sam], 9)
    expect(mine.map((c) => c.case_id)).toEqual([1, 2])
    expect(others.map((c) => c.case_id)).toEqual([ana.case_id, sam.case_id])
    expect(casesHeader({ all: 34, mine: 2, others: 32 }, 'TRACI 2.1 · US')).toBe('34 cases · 2 yours, 32 from members · TRACI 2.1 · US')
    expect(casesHeader({ all: 1, mine: 1, others: 0 }, null)).toBe('1 case')
    expect(answerOf(base)).toBe('1.72')
    expect(answerOf(ana)).toBe('1.682')
    expect(answerOf(sam)).toBeNull()
    expect(changeVsBase(whatIf, base)).toBe('▼ 3.1%')
    expect(changeVsBase(base, base)).toBeNull()
  })
  it('search by person or case', () => {
    expect(matchesSearch(ana, 'ana')).toBe(true)
    expect(matchesSearch(ana, "sam's")).toBe(false)
    expect(matchesSearch(sam, 'ortiz')).toBe(true)
  })
})
