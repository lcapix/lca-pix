import { describe, expect, it } from 'vitest'
import { importStages, materialsStageNote } from '@/lib/import/stages'
import { lineKind, tickedLinesSentence } from '@/lib/import/line-kind'
import { plausibleMatches, type CatalogSubstance } from '@/lib/ingest/maplca'

describe('lineKind (F4: an electricity line is not a material)', () => {
  it('reads energy from the unit or the name, else a material', () => {
    expect(lineKind({ substance_text: 'Cold saw 275 mm: 1.1 kW', unit: 'kWh' })).toBe('energy')
    expect(lineKind({ substance_text: 'Gas', substance_name: 'Natural gas', unit: 'm3' })).toBe('energy')
    expect(lineKind({ substance_text: 'Frame tube set', substance_name: 'Aluminum', unit: 'kg' })).toBe('material')
    expect(lineKind({ substance_text: 'Shipping box', unit: 'ea' })).toBe('material')
  })
  it('says what the ticked lines are saved as', () => {
    expect(tickedLinesSentence(['energy', 'energy'])).toBe('The 2 ticked lines are saved as energy use.')
    expect(tickedLinesSentence(['material'])).toBe('The 1 ticked line is saved as a material.')
    expect(tickedLinesSentence(['material', 'material', 'energy'])).toBe('The 3 ticked lines are saved as 2 materials and 1 energy line.')
    expect(tickedLinesSentence([])).toBe('No line is ticked, so none is saved.')
  })
})

describe('importStages (F4: a stage where the file implies one)', () => {
  const steps = [
    { id: 1, name: 'Bike', tier: 'product', stage: null, created: false },
    { id: 2, name: '10. Cut tube', tier: 'operation', stage: 'production', created: false },
    { id: 3, name: '30. Pack', tier: 'operation', stage: null, created: false },
    { id: 4, name: '40. Ship', tier: 'operation', stage: 'distribution', created: false },
    { id: 5, name: '20. Weld', tier: 'operation', stage: null, created: false },
  ]
  it('puts the steps that take in a bill of materials in Materials, never over a stage a person chose', () => {
    const out = importStages({
      docType: 'bom',
      steps,
      lines: [
        { step_id: 2, direction: 'input', unit: 'kg', substance_text: 'Frame tube set' },
        { step_id: 3, direction: 'input', unit: 'kg', substance_text: 'Shipping box' },
        { step_id: 4, direction: 'input', unit: 'kg', substance_text: 'Tape' },
      ],
    })
    expect(out).toEqual([
      { id: 2, name: '10. Cut tube', stage: 'materials' },
      { id: 3, name: '30. Pack', stage: 'materials' },
    ])
  })
  it('gives an equipment list or a routing Production, only where no stage is set', () => {
    const out = importStages({
      docType: 'equipment',
      steps: [...steps, { id: 6, name: '50. New', tier: 'operation', stage: null, created: true }],
      lines: [
        { step_id: 2, direction: 'input', unit: 'kWh', substance_text: 'Electricity' },
        { step_id: 5, direction: 'input', unit: 'kWh', substance_text: 'Electricity' },
      ],
    })
    expect(out).toEqual([
      { id: 5, name: '20. Weld', stage: 'production' },
      { id: 6, name: '50. New', stage: 'production' },
    ])
  })
  it('leaves an electricity line on a bill of materials in Production', () => {
    const out = importStages({ docType: 'bom', steps, lines: [{ step_id: 5, direction: 'input', unit: 'kWh', substance_text: 'Electricity' }] })
    expect(out).toEqual([{ id: 5, name: '20. Weld', stage: 'production' }])
  })
  it('names the steps set to Materials', () => {
    expect(materialsStageNote([{ name: '10. Cut tube', stage: 'materials' }, { name: '30. Pack', stage: 'materials' }, { name: 'x', stage: 'production' }])).toBe(
      'Stage set to Materials on 10. Cut tube and 30. Pack, because they take in the bill of materials. Change it on the step if it is wrong.',
    )
    expect(materialsStageNote([{ name: 'x', stage: 'production' }])).toBeNull()
  })
})

describe('plausibleMatches (F3: no pesticides for Cardboard)', () => {
  // Library names and kinds as the substance table has them.
  const lib: CatalogSubstance[] = [
    { substance_id: 1, substance_name: 'Cardboard', category: 'resource', factor_value: 0.937, factor_count: 1 },
    { substance_id: 2, substance_name: 'Carbaryl', category: 'emission_air', factor_count: 0 },
    { substance_id: 3, substance_name: 'Carbofuran', category: 'emission_air', factor_count: 0 },
    { substance_id: 4, substance_name: 'Carbon tetrachloride', category: 'emission_air', factor_count: 1 },
    { substance_id: 5, substance_name: 'Aluminum', category: 'resource', factor_value: 8.6, factor_count: 1 },
    { substance_id: 6, substance_name: 'Aluminum, recycled', category: 'resource', factor_value: 0.6, factor_count: 1 },
    { substance_id: 7, substance_name: 'Stainless Steel', category: 'resource', factor_value: 6.15, factor_count: 1 },
  ]
  it('drops emissions for an input and anything under the import bar', () => {
    const names = plausibleMatches('Cardboard', 'input', lib).map((c) => c.substance_name)
    expect(names).toEqual(['Cardboard'])
  })
  it('keeps spellings near the best and ranks by score', () => {
    expect(plausibleMatches('Aluminium', 'input', lib).map((c) => c.substance_name)).toEqual(['Aluminum', 'Aluminum, recycled'])
    expect(plausibleMatches('Stainless', 'input', lib).map((c) => c.substance_name)).toEqual(['Stainless Steel'])
  })
  it('offers nothing for a name nothing is close to', () => {
    expect(plausibleMatches('Walnut veneer', 'input', lib)).toEqual([])
  })
})
