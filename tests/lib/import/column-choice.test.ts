import { describe, expect, it } from 'vitest'
import { applyChoice, cleanChoice, columnsReady, headerSignature } from '@/lib/ingest/column-fields'
import { chooseColumn, columnsSummary, type ColumnInfo } from '@/lib/import/columns'

describe('which column is which (F2.3)', () => {
  it('the person’s choice moves a column to its field and takes the field from the column that had it', () => {
    const auto = { description: 'Name', quantity: 'Qty', weight: 'Wt' }
    expect(applyChoice(auto, { Count: 'quantity', Wt: 'ignore' }, 'bom')).toEqual({ description: 'Name', quantity: 'Count' })
  })

  it('a field the kind of file does not have is not applied', () => {
    expect(applyChoice({}, { Power: 'power' }, 'bom')).toEqual({})
  })

  it('a file is ready only with the columns it needs', () => {
    expect(columnsReady('bom', { material: 'M' })).toBe(false)
    expect(columnsReady('bom', { material: 'M', weight: 'W' })).toBe(true)
    expect(columnsReady('routing', { seq: 'Op' })).toBe(true)
    expect(columnsReady('equipment', { workCenter: 'WC' })).toBe(false)
  })

  it('a choice from the browser keeps only real columns and fields', () => {
    expect(cleanChoice('{"A":"material","B":"colour","Z":"weight","C":"ignore"}', ['A', 'B', 'C'], 'bom')).toEqual({ A: 'material', C: 'ignore' })
    expect(cleanChoice('not json', ['A'], 'bom')).toBeNull()
  })

  it('the same headers in any order or case are one layout; other headers are another', () => {
    expect(headerSignature(['Qty', 'Name'])).toBe(headerSignature([' name', 'QTY']))
    expect(headerSignature(['Qty', 'Name'])).not.toBe(headerSignature(['Qty', 'Name', 'Cost']))
  })

  it('choosing a field for a column leaves out the column that had it, and the summary counts', () => {
    const next = chooseColumn({ A: 'quantity', B: 'material' }, 'C', 'quantity')
    expect(next).toEqual({ A: 'ignore', B: 'material', C: 'quantity' })
    const info: ColumnInfo = {
      message: null,
      headers: [{ name: 'A', sample: '' }, { name: 'B', sample: '' }, { name: 'C', sample: '' }, { name: 'D', sample: '' }],
      fields: [],
      needed: '',
      source: 'header',
    }
    expect(columnsSummary(info, next)).toBe('2 columns read, 2 not used')
  })
})
