import { describe, expect, it } from 'vitest'
import { documentAsFile, importableKind } from '@/lib/case-editor/case-documents'

describe('a stored document goes to the importer (Documents: Import into this case)', () => {
  it('only a routing, a bill of materials or an equipment list can be imported', () => {
    expect(['routing', 'bom', 'equipment'].map(importableKind)).toEqual(['routing', 'bom', 'equipment'])
    expect(['epd', 'sds', 'itac', 'other', null].map(importableKind)).toEqual([null, null, null, null, null])
  })
  it('a spreadsheet kept as tab-separated rows goes back to a CSV of the same rows', () => {
    const f = documentAsFile('frame-bom.xlsx', 'part\tqty\tunit\nTube, 6061\t2.2\tkg\nTape "blue"\t1\troll')
    expect(f).toEqual({ name: 'frame-bom.csv', type: 'text/csv', text: 'part,qty,unit\n"Tube, 6061",2.2,kg\n"Tape ""blue""",1,roll' })
  })
  it('a CSV stays a CSV; a PDF text goes as plain text under its own name', () => {
    expect(documentAsFile('routing.csv', 'op\thours\n10\t0.3').name).toBe('routing.csv')
    expect(documentAsFile('epd.pdf', 'Declared unit: 1 kg')).toEqual({ name: 'epd.txt', text: 'Declared unit: 1 kg', type: 'text/plain' })
  })
})
