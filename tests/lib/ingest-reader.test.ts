import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import { parseDurationHours, parseQuantity } from '@/lib/ingest/parse-values'
import { readSheet } from '@/lib/ingest/sheet-reader'
import { isRoutingHeader } from '@/lib/ingest/routing'
import { suggestPlacement } from '@/lib/ingest/placement'

describe('parseQuantity / parseDurationHours', () => {
  it('reads real-world numbers as written', () => {
    expect(parseQuantity('0,5')?.value).toBe(0.5)
    expect(parseQuantity('1,200.5')?.value).toBe(1200.5)
    expect(parseQuantity('1/2')?.value).toBe(0.5)
    expect(parseQuantity('1 1/2')?.value).toBe(1.5)
    expect(parseQuantity('3-4')).toMatchObject({ value: 3.5, estimate: true })
    expect(parseQuantity('4861.20 g')).toMatchObject({ value: 4861.2, unit: 'g' })
    expect(parseQuantity('1.234,5', { decimalComma: true })?.value).toBe(1234.5)
  })
  it('reads durations in hours', () => {
    expect(parseDurationHours('20 min')).toBeCloseTo(1 / 3)
    expect(parseDurationHours('1:30')).toBe(1.5)
    expect(parseDurationHours('2.5 hrs')).toBe(2.5)
    expect(parseDurationHours(45, 'min')).toBe(0.75)
  })
})

describe('readSheet', () => {
  it('finds the routing on the second sheet under a title block', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['READ ME'], ['This workbook holds the routing.']]), 'READ ME')
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Acme Machining'],
        ['Part: 4471'],
        [],
        ['Op No', 'Operation', 'Work Center', 'Run Time (min)'],
        [10, 'Saw', 'Saw 1', 30],
        ['TOTAL', '', '', 30],
      ]),
      'Routing',
    )
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const read = readSheet(buf, 'traveler.xlsx', isRoutingHeader)!
    expect(read.sheetName).toBe('Routing')
    expect(read.headerRow).toBe(4)
    expect(read.rows).toHaveLength(1) // TOTAL row skipped
    expect(read.timeHints['Run Time']).toBe('min')
  })

  it('keeps "1/2" as text in a CSV and reads a semicolon file with decimal commas', () => {
    const csv = Buffer.from('Part;Material;Quantity;Unit\nWasher;Steel;0,5;kg\nClip;Steel;1/2;kg\n')
    const read = readSheet(csv, 'bom.csv', (h) => /part|material|quantity|unit/i.test(h))!
    expect(read.decimalComma).toBe(true)
    expect(read.rows.map((r) => r.Quantity)).toEqual(['0,5', '1/2'])
  })
})

describe('suggestPlacement', () => {
  const steps = [
    { id: 1, name: '10. Cut & miter frame tubes', tier: 'operation' },
    { id: 2, name: '60. Build & true wheels', tier: 'operation' },
    { id: 3, name: '70. Final assembly', tier: 'operation' },
  ]
  it('uses the step the document names, then shared words, then assembly', () => {
    expect(suggestPlacement({ label: 'Rim', opHint: '60' }, steps)).toMatchObject({ stepId: 2, confidence: 0.95 })
    expect(suggestPlacement({ label: 'Front Wheel' }, steps)).toMatchObject({ stepId: 2 })
    expect(suggestPlacement({ label: 'Touring Frame' }, steps)).toMatchObject({ stepId: 1 })
    expect(suggestPlacement({ label: 'Chain' }, steps)).toMatchObject({ stepId: 3, confidence: 0.4 })
  })
})
