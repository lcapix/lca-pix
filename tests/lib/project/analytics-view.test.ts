import { describe, expect, it } from 'vitest'
import { axisTicks, classCounts, emptyRows, firstName, labelled, labelRows, landed, landedLine, studentCases, tickDecimals, type ClassCase } from '@/lib/project/analytics-view'

const run = (value: number, method = 'TRACI 2.1', region = 'US') => ({ run_id: 1, method, region, headline: { value, unit: 'kg CO2 eq' } })
const c = (id: number, by: number, extra: Partial<ClassCase> = {}): ClassCase => ({
  case_id: id,
  case_name: `Case ${id}`,
  case_type: 'comparative',
  created_by: by,
  author: `Person ${id} Last`,
  has_interpretation: false,
  is_final: false,
  latest_run: null,
  ...extra,
})

describe('analytics view', () => {
  const cases = [
    c(1, 1, { case_type: 'base', latest_run: run(1.72) }),
    c(2, 2, { latest_run: run(1.625), has_interpretation: true, is_final: true }),
    c(3, 3, { latest_run: run(1.74), has_interpretation: true }),
    c(4, 4, { latest_run: run(1.7, 'CML 2001') }),
    c(5, 5),
  ]
  const students = studentCases(cases, new Set([1]))

  it('counts the student cases from each case, not the owner\'s', () => {
    expect(students.map((s) => s.case_id)).toEqual([2, 3, 4, 5])
    expect(classCounts(students)).toEqual({ cases: 4, ran: 3, wrote: 2, ticked: 1, notRun: 1 })
  })

  it('puts runs of the base case\'s method and region on the axis, and counts the rest', () => {
    const { dots, otherScope } = landed(students, { method: 'TRACI 2.1', region: 'US' })
    expect(dots.map((d) => [d.who, d.value])).toEqual([
      ['Person', 1.625],
      ['Person', 1.74],
    ])
    expect(otherScope).toBe(1)
    expect(landedLine(dots, 1.72)).toBe('2 runs between 1.63 and 1.74. The base case is 1.72.')
    expect(firstName('Dr. Omar Haddad')).toBe('Omar')
  })

  it('picks ticks on a round step that cover every value', () => {
    const t = axisTicks([1.61, 1.75, 1.72])
    expect(t.step).toBeCloseTo(0.04, 12)
    expect(t.ticks).toEqual([1.6, 1.64, 1.68, 1.72, 1.76])
    expect(tickDecimals(t.step)).toBe(2)
    expect(axisTicks([2, 2]).ticks.length).toBeGreaterThan(1)
  })

  it('names the ticked hand-ins (or the ends) and keeps labels apart', () => {
    const dots = [
      { case_id: 1, who: 'A', case_name: '', value: 1, ticked: false },
      { case_id: 2, who: 'B', case_name: '', value: 2, ticked: false },
      { case_id: 3, who: 'C', case_name: '', value: 3, ticked: false },
    ]
    expect([...labelled(dots)]).toEqual([1, 3])
    const rows = labelRows([
      { id: 1, x: 100, width: 80 },
      { id: 2, x: 120, width: 80 },
      { id: 3, x: 400, width: 80 },
    ])
    expect([rows.get(1), rows.get(2), rows.get(3)]).toEqual([0, 1, 0])
  })

  it('ranks the flows left empty among the cases that ran', () => {
    const rows = emptyRows(
      [
        { substance: 'Argon', direction: 'input', step: '20. Weld tab', case_ids: [2, 3, 9] },
        { substance: 'Scrap steel', direction: 'output', step: '40. Pack and ship', case_ids: [5] },
        { substance: 'Powder coating', direction: 'input', step: '30. Powder coat and cure', case_ids: [3] },
      ],
      new Set([2, 3, 4]),
    )
    expect(rows).toEqual([
      { substance: 'Argon', direction: 'input', step: '20. Weld tab', cases: 2 },
      { substance: 'Powder coating', direction: 'input', step: '30. Powder coat and cure', cases: 1 },
    ])
  })
})
