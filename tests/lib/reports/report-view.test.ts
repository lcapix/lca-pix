import { describe, expect, it } from 'vitest'
import { caseOption, formatNote, PDF_SECTIONS, scopeLine } from '@/lib/reports/report-view'
import { placeHref } from '@/lib/shell/routes'

describe('report view', () => {
  it('lists the PDF sections in the order they print', () => {
    expect(PDF_SECTIONS).toHaveLength(9)
    expect(PDF_SECTIONS[4]).toBe('Totals')
    expect(PDF_SECTIONS[6]).toBe('Interpretation')
  })

  it('says what each format holds and which moment it shows', () => {
    expect(formatNote('pdf', 301)).toBe('Prints Run #301 as it was when it ran. The write-up prints as it is now.')
    expect(formatNote('csv', 301)).toMatch(/^Every flow of Run #301 by impact category/)
    expect(formatNote('pptx', 301)).toMatch(/^Slides of Run #301/)
  })

  it('words the case picker and the scope line', () => {
    expect(caseOption({ case_name: 'Base case', latest_run: { run_id: 301 } }, false)).toBe('Base case · Run #301')
    expect(caseOption({ case_name: "Ana's case", author: 'Ana Ruiz', latest_run: null }, true)).toBe("Ana's case (Ana Ruiz) · not run yet")
    expect(scopeLine({ project: 'Steel bracket · LCA 301', method: 'TRACI 2.1', region: 'US', fu: '1 bracket' })).toBe('Steel bracket · LCA 301 · TRACI 2.1 · US · per 1 bracket')
  })

  it('opens Reports on the open project', () => {
    expect(placeHref('reports', 93)).toBe('/reports?project=93')
    expect(placeHref('reports', null)).toBe('/reports')
  })
})
