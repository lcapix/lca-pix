import { describe, it, expect } from 'vitest'

import { getDocType } from '@/lib/ingest/doc-types'
import {
  akaHint,
  isLLMImport,
  previewFields,
  previewValidationError,
  sampleProductName,
  templateCsv,
  templateFilename,
} from '@/lib/import/preview'

describe('isLLMImport', () => {
  it('is true for an llm document type whatever the file', () => {
    const epd = getDocType('epd')
    expect(epd?.mode).toBe('llm')
    expect(isLLMImport(epd, 'epd', null)).toBe(true)
    expect(isLLMImport(epd, 'epd', { name: 'x.csv' })).toBe(true)
  })

  it('reads a routing spreadsheet deterministically and anything else through the AI path', () => {
    const routing = getDocType('routing')
    expect(isLLMImport(routing, 'routing', null)).toBe(false)
    for (const name of ['r.csv', 'r.xlsx', 'r.XLS', 'r.tsv']) expect(isLLMImport(routing, 'routing', { name })).toBe(false)
    for (const name of ['r.pdf', 'r.html', 'r.txt', 'r.csv.pdf', 'csv']) expect(isLLMImport(routing, 'routing', { name })).toBe(true)
  })

  it('is false for a structured, non-routing document', () => {
    expect(isLLMImport(getDocType('bom'), 'bom', { name: 'b.pdf' })).toBe(false)
    expect(isLLMImport(undefined, 'unknown', { name: 'b.pdf' })).toBe(false)
  })
})

describe('akaHint', () => {
  it('lists the first three aliases', () => {
    expect(akaHint(getDocType('routing'))).toBe(' Also called: routing sheet, route sheet, traveler.')
  })

  it('is empty without a doc type or aliases', () => {
    expect(akaHint(undefined)).toBe('')
    expect(akaHint({ ...getDocType('bom')!, aka: [] })).toBe('')
  })
})

describe('previewValidationError', () => {
  const base = { hasFile: true, connector: 'bom', plantId: '', targetCaseId: null }

  it('needs a file', () => {
    expect(previewValidationError({ ...base, hasFile: false })).toBe('Choose a file (.csv or .xlsx).')
  })

  it('needs a file and an assessment ID for ITAC (blank counts as missing)', () => {
    const msg = 'Choose a file and enter an assessment ID (e.g. WV0661).'
    expect(previewValidationError({ ...base, connector: 'itac', hasFile: false, plantId: 'WV0661' })).toBe(msg)
    expect(previewValidationError({ ...base, connector: 'itac', plantId: '   ' })).toBe(msg)
    expect(previewValidationError({ ...base, connector: 'itac', plantId: 'WV0661' })).toBeNull()
  })

  it('needs a target case for an equipment list, after the file check', () => {
    expect(previewValidationError({ ...base, connector: 'equipment' })).toBe(
      'An equipment list adds energy to the steps of an existing case: choose that case under ADD TO.',
    )
    expect(previewValidationError({ ...base, connector: 'equipment', hasFile: false })).toBe('Choose a file (.csv or .xlsx).')
    expect(previewValidationError({ ...base, connector: 'equipment', targetCaseId: 0 })).toBeNull()
  })

  it('passes a file for the other connectors', () => {
    expect(previewValidationError(base)).toBeNull()
    expect(previewValidationError({ ...base, connector: 'routing' })).toBeNull()
  })
})

describe('previewFields', () => {
  it('sends connector and trimmed plant id', () => {
    expect(previewFields({ connector: 'itac', plantId: ' WV0661 ', lotSize: '25', targetCaseId: null })).toEqual([
      ['connector', 'itac'],
      ['plant_id', 'WV0661'],
    ])
  })

  it('adds a positive lot size for a routing, normalised as a number', () => {
    expect(previewFields({ connector: 'routing', plantId: '', lotSize: '025', targetCaseId: null })).toEqual([
      ['connector', 'routing'],
      ['plant_id', ''],
      ['lot_size', '25'],
    ])
    expect(previewFields({ connector: 'routing', plantId: '', lotSize: '2.5', targetCaseId: null })[2]).toEqual(['lot_size', '2.5'])
    for (const lotSize of ['', '0', '-3', 'abc']) {
      expect(previewFields({ connector: 'routing', plantId: '', lotSize, targetCaseId: null })).toHaveLength(2)
    }
  })

  it('adds the target case last when appending (0 included)', () => {
    expect(previewFields({ connector: 'routing', plantId: 'Bike', lotSize: '5', targetCaseId: 7 })).toEqual([
      ['connector', 'routing'],
      ['plant_id', 'Bike'],
      ['lot_size', '5'],
      ['target_case_id', '7'],
    ])
    expect(previewFields({ connector: 'bom', plantId: '', lotSize: '', targetCaseId: 0 })[2]).toEqual(['target_case_id', '0'])
  })
})

describe('sampleProductName', () => {
  it('fills "Touring bike" for a routing or BOM sample when no name is typed', () => {
    expect(sampleProductName('routing', '')).toBe('Touring bike')
    expect(sampleProductName('bom', '   ')).toBe('Touring bike')
  })

  it('keeps a typed name, and fills nothing for other samples', () => {
    expect(sampleProductName('bom', 'My bike')).toBeNull()
    expect(sampleProductName('equipment', '')).toBeNull()
    expect(sampleProductName('itac', '')).toBeNull()
  })
})

describe('templateCsv / templateFilename', () => {
  it('keeps the header row and a newline', () => {
    expect(templateCsv('a,b,c\n1,2,3\n4,5,6')).toBe('a,b,c\n')
    expect(templateCsv('only,header')).toBe('only,header\n')
    expect(templateCsv('')).toBe('\n')
  })

  it('names the template by connector', () => {
    expect(templateFilename('bom')).toBe('bom-template.csv')
  })
})
