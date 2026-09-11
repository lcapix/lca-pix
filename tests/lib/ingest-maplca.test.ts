import { describe, expect, it } from 'vitest'

import {
  convertIngestUnit,
  mapModel,
  matchSubstance,
  sequenceRatio,
  type CatalogSubstance,
} from '@/lib/ingest/maplca'
import { structureItac } from '@/lib/ingest/itac'

const CATALOG: CatalogSubstance[] = [
  { substance_id: 1, substance_name: 'Electricity', unit: 'kWh', factor_count: 6 },
  { substance_id: 2, substance_name: 'Natural Gas', unit: 'm3', factor_count: 6 },
  { substance_id: 3, substance_name: 'Solid Waste', unit: 'kg', factor_count: 4 },
  { substance_id: 4, substance_name: 'Water', unit: 'm3', factor_count: 0 },
  { substance_id: 5, substance_name: 'Steel, reinforced', unit: 'g', factor_count: 6 },
]

describe('sequenceRatio', () => {
  it('matches difflib.SequenceMatcher on known pairs', () => {
    // Values checked against Python: difflib.SequenceMatcher(None, a, b).ratio()
    expect(sequenceRatio('abcd', 'bcde')).toBeCloseTo(0.75, 10)
    expect(sequenceRatio('natural gas', 'natural gas')).toBe(1)
    expect(sequenceRatio('', '')).toBe(1)
    expect(sequenceRatio('abc', 'xyz')).toBe(0)
  })
})

describe('convertIngestUnit', () => {
  it('uses the substance-specific rule first: MMBtu of natural gas → m3', () => {
    const r = convertIngestUnit(4200, 'MMBtu', 'Natural Gas')
    expect(r.unit).toBe('m3')
    expect(r.quantity).toBeCloseTo(4200 * 28.263, 6)
    expect(r.note).toContain('EIA heat content')
  })

  it('falls back to the generic rule: MMBtu of coal → kWh', () => {
    const r = convertIngestUnit(10, 'MMBtu', 'Coal')
    expect(r.unit).toBe('kWh')
    expect(r.quantity).toBeCloseTo(2930.71, 2)
  })

  it('converts lbs → kg and Tgal → m3 with named factors', () => {
    expect(convertIngestUnit(90000, 'lbs', 'Solid Waste').quantity).toBeCloseTo(40823.3133, 3)
    expect(convertIngestUnit(5, 'Tgal', 'Water').quantity).toBeCloseTo(18.92705892, 6)
  })

  it('passes through unknown units loudly, never silently', () => {
    const r = convertIngestUnit(3, 'bushels', 'Wheat')
    expect(r.quantity).toBe(3)
    expect(r.unit).toBe('bushels')
    expect(r.note).toContain('NO CONVERSION RULE')
  })
})

describe('matchSubstance', () => {
  it('finds exact names with score 1 and returns ranked candidates', () => {
    const { best, score, candidates } = matchSubstance('Natural Gas', CATALOG)
    expect(best?.substance_id).toBe(2)
    expect(score).toBe(1)
    expect(candidates[0].substance_id).toBe(2)
    expect(candidates.length).toBeLessThanOrEqual(3)
  })

  it('applies the 0.85 floor for substring containment', () => {
    const { best, score } = matchSubstance('Steel', CATALOG)
    expect(best?.substance_id).toBe(5)
    expect(score).toBeGreaterThanOrEqual(0.85)
  })

  it('returns null below the 0.55 accept threshold but still lists candidates', () => {
    const { best, candidates } = matchSubstance('Molybdenum disulfide', CATALOG)
    expect(best).toBeNull()
    expect(candidates.length).toBeGreaterThan(0)
  })
})

describe('mapModel', () => {
  const ROW: Record<string, unknown> = {
    ID: 'TS0001',
    FY: 2024,
    PRODUCTS: 'Electroplated parts',
    PRODLEVEL: 1200000,
    EC_plant_usage: 2500000,
    EC_plant_cost: 210000,
    E2_plant_usage: 4200,
    W4_plant_usage: 90000,
  }

  it('maps the ITAC model end to end: converted units, matched ids, provenance', () => {
    const pm = structureItac([ROW], 'TS0001', 'ITAC.xlsx')
    const plan = mapModel(pm, CATALOG)
    expect(plan.flows).toHaveLength(3)
    const gas = plan.flows.find((f) => f.substance_text === 'Natural Gas')!
    expect(gas.substance_id).toBe(2)
    expect(gas.unit).toBe('m3')
    expect(gas.quantity).toBeCloseTo(118704.6, 1)
    expect(gas.provenance).toContain('ITAC.xlsx')
    // exact-name matches at score 1 ⇒ no low-confidence review lines for them
    expect(plan.review.filter((r) => r.includes('LOW-CONFIDENCE'))).toHaveLength(0)
  })

  it('holds back unmatched substances into review instead of dropping them', () => {
    const pm = structureItac([ROW], 'TS0001', 'ITAC.xlsx')
    pm.flows.push({
      node: 'Electricity consumption FY2024',
      substance_text: 'Trichloroethylene vapor degreaser',
      direction: 'input',
      quantity: 12,
      unit: 'kg',
    })
    const plan = mapModel(pm, CATALOG)
    const held = plan.flows.find((f) => f.substance_text.includes('Trichloroethylene'))!
    expect(held.substance_id).toBeNull()
    expect(plan.review.some((r) => r.startsWith('UNMATCHED SUBSTANCE'))).toBe(true)
  })

  it('flags matches whose substance has zero impact factors', () => {
    const pm = structureItac([{ ...ROW, W0_plant_usage: 300 }], 'TS0001', 'ITAC.xlsx')
    const plan = mapModel(pm, CATALOG)
    expect(plan.review.some((r) => r.startsWith('NO IMPACT DATA'))).toBe(true)
  })

  it('returns only STRUCTURE review lines for an invalid model', () => {
    const pm = structureItac([ROW], 'TS0001', 'ITAC.xlsx')
    pm.nodes[1].parent = 'No such node'
    const plan = mapModel(pm, CATALOG)
    expect(plan.flows).toHaveLength(0)
    expect(plan.review.every((r) => r.startsWith('STRUCTURE:'))).toBe(true)
  })
})
