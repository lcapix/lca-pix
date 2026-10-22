import { describe, expect, it } from 'vitest'

import { listPlantIds, structureItac } from '@/lib/ingest/itac'
import { validateProcessModel } from '@/lib/ingest/schema'

// A synthetic ASSESS row shaped like SheetJS sheet_to_json output for the
// real DOE ITAC workbook. WV0661-like: electricity + natural gas + solid
// waste, with a demand-charge cost and several absent streams.
const ROW: Record<string, unknown> = {
  ID: 'TS0001',
  FY: 2024,
  PRODUCTS: 'Electroplated parts',
  NAICS: 332813,
  STATE: 'WV',
  EMPLOYEES: 85,
  PRODLEVEL: 1200000,
  PRODHOURS: 4080,
  EC_plant_usage: 2500000, // kWh
  EC_plant_cost: 210000,
  E2_plant_usage: 4200, // MMBtu natural gas
  E2_plant_cost: 38000,
  ED_plant_cost: 26000, // demand charges: cost only, no flow
  W4_plant_usage: 90000, // lbs solid waste
  W4_plant_cost: 12000,
  // absent/empty streams must produce nothing:
  E3_plant_usage: '',
  W0_plant_usage: null,
  W1_plant_usage: 0,
}

describe('structureItac', () => {
  it('builds a valid model with one operation per present stream, no invented levels', () => {
    const pm = structureItac([ROW], 'TS0001', 'ITAC.xlsx')
    expect(validateProcessModel(pm)).toEqual([])
    // product + facility + 3 stream operations
    expect(pm.nodes).toHaveLength(2 + 3)
    expect(pm.flows).toHaveLength(3)
    expect(pm.case_name).toBe('Ingested: ITAC TS0001 (Electroplated parts, FY2024)')
    const op = pm.nodes.find((n) => n.name === 'Electricity consumption FY2024')
    expect(op?.tier).toBe('operation')
    expect(op?.parent).toBe('Facility energy & utility systems')
  })

  it('keeps units and quantities exactly as the document states them', () => {
    const pm = structureItac([ROW], 'TS0001', 'ITAC.xlsx')
    const gas = pm.flows.find((f) => f.substance_text === 'Natural Gas')
    expect(gas).toMatchObject({ quantity: 4200, unit: 'MMBtu', direction: 'input' })
    const waste = pm.flows.find((f) => f.substance_text === 'Solid Waste')
    expect(waste).toMatchObject({ quantity: 90000, unit: 'lbs', direction: 'output' })
  })

  it('attaches demand charges as a cost-only line on the electricity leaf', () => {
    const pm = structureItac([ROW], 'TS0001', 'ITAC.xlsx')
    const elecCosts = pm.costs.filter((c) => c.node === 'Electricity consumption FY2024')
    expect(elecCosts.map((c) => c.amount).sort((a, b) => a - b)).toEqual([26000, 210000])
    // but no extra flow for demand charges
    expect(pm.flows.filter((f) => f.node === 'Electricity consumption FY2024')).toHaveLength(1)
  })

  it('skips absent, empty, and zero streams without inventing values', () => {
    const pm = structureItac([ROW], 'TS0001', 'ITAC.xlsx')
    const names = pm.flows.map((f) => f.substance_text)
    expect(names).not.toContain('LPG')
    expect(names).not.toContain('Water')
    expect(names).not.toContain('Wastewater')
  })

  it('throws on an unknown plant id', () => {
    expect(() => structureItac([ROW], 'NOPE', 'ITAC.xlsx')).toThrow('assessment NOPE not found')
  })

  it('every node and flow carries provenance back to the workbook row', () => {
    const pm = structureItac([ROW], 'TS0001', 'ITAC.xlsx')
    for (const n of pm.nodes) expect(n.provenance?.locator).toContain('ID=TS0001')
    for (const f of pm.flows) expect(f.provenance?.doc).toBe('ITAC.xlsx')
  })
})

describe('listPlantIds', () => {
  it('filters by substring and caps the sample', () => {
    const rows = [{ ID: 'WV0661' }, { ID: 'WV0662' }, { ID: 'OH0100' }]
    expect(listPlantIds(rows, 'WV')).toEqual({ total: 2, sample: ['WV0661', 'WV0662'] })
    expect(listPlantIds(rows).total).toBe(3)
  })
})
