import { describe, it, expect } from 'vitest'
import { DOC_TYPES, docTypeLabel, documentsError, highlightParts, hitSummary, matchingLines } from '@/lib/case-editor/case-documents'
import { SAMPLE_DOCS } from '@/lib/ingest/sample-docs'

describe('docTypeLabel', () => {
  it('names the kinds the upload form offers', () => {
    expect(DOC_TYPES.map((t) => t.value)).toEqual(['routing', 'bom', 'equipment', 'epd', 'sds', 'itac', 'other'])
    expect(docTypeLabel('bom')).toBe('Bill of materials')
    expect(docTypeLabel('itac')).toBe('ITAC report')
  })
  it('reads an unknown type as itself and no type as Document', () => {
    expect(docTypeLabel('invoice')).toBe('invoice')
    expect(docTypeLabel(null)).toBe('Document')
    expect(docTypeLabel('  ')).toBe('Document')
  })
  it('has no em dash in any label', () => {
    for (const t of DOC_TYPES) expect(t.label).not.toMatch(/\u2014/)
  })
})

describe('matchingLines', () => {
  const text = 'Op No,Operation\n10,Cut tube\r\n20,Weld frame\n30,Pack'

  it('shows every line, numbered from 1, with no search', () => {
    const all = matchingLines(text, '  ')
    expect(all.map((l) => l.n)).toEqual([1, 2, 3, 4])
    expect(all.every((l) => !l.hit)).toBe(true)
    // A Windows line end is not left on the text.
    expect(all[1].text).toBe('10,Cut tube')
  })

  it('keeps only the lines that match, ignoring case, with their own numbers', () => {
    expect(matchingLines(text, 'WELD')).toEqual([{ n: 3, text: '20,Weld frame', hit: true }])
    expect(matchingLines(text, ' op ').map((l) => l.n)).toEqual([1])
    expect(matchingLines(text, 'oven')).toEqual([])
  })

  it('finds a work center in the bundled sample routing', () => {
    const hits = matchingLines(SAMPLE_DOCS.routing.content, 'WLD-01')
    expect(hits.map((l) => l.n)).toEqual([3, 4])
  })
})

describe('hitSummary', () => {
  it('says nothing without a search, then counts in words', () => {
    expect(hitSummary('', 5)).toBeNull()
    expect(hitSummary('x', 0)).toBe('No line matches')
    expect(hitSummary('x', 1)).toBe('1 line matches')
    expect(hitSummary('x', 4)).toBe('4 lines match')
  })
})

describe('highlightParts', () => {
  it('marks every match where it sits, keeping the original case', () => {
    expect(highlightParts('Weld frame, weld dropouts', 'weld')).toEqual([
      { text: 'Weld', hit: true },
      { text: ' frame, ', hit: false },
      { text: 'weld', hit: true },
      { text: ' dropouts', hit: false },
    ])
  })
  it('returns the line whole with no search or no match', () => {
    expect(highlightParts('Pack', '')).toEqual([{ text: 'Pack', hit: false }])
    expect(highlightParts('Pack', 'oven')).toEqual([{ text: 'Pack', hit: false }])
  })
  it('puts the parts back together as the line', () => {
    const line = '20,Weld frame,Fabrication,WLD-01 TIG weld cell'
    expect(highlightParts(line, 'weld').map((p) => p.text).join('')).toBe(line)
  })
})

describe('documentsError', () => {
  it("uses the route's own reason when it sends one", () => {
    expect(documentsError(415, { error: 'That file type is not read here' })).toBe('That file type is not read here')
  })
  it('falls back to the status', () => {
    expect(documentsError(500, null)).toBe('The server answered 500.')
    expect(documentsError(502, { error: '' })).toBe('The server answered 502.')
  })
})
