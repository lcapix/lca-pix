import { describe, expect, it } from 'vitest'

import { diffInventories, type CaseInventory } from '@/lib/compare/diff'
import { convertIngestUnit } from '@/lib/ingest/maplca'
import { convertQuantity, toFactorBasis } from '@/lib/units'

// The spellings the engine reads differently from a case-insensitive compare:
// 'Mg' is a megagram (and rejected as ambiguous), 'm³' is m3, 'mwh' is not a
// megawatt-hour. Compare Cases and ingest must read them as the engine does.
const PAIRS: Array<[string, string]> = [
  ['mg', 'Mg'],
  ['m3', 'm³'],
  ['MWh', 'mwh'],
]

/** What the engine does with a flow in `flowUnit` on a factor per `basis`. */
const engineSame = (flowUnit: string, basis: string) => {
  const r = toFactorBasis(1, flowUnit, basis, null)
  return r.ok && r.quantity === 1
}

const noCost = { material: 0, labor: 0, energy: 0, transportation: 0, equipment: 0, overhead: 0, opex: 0, capex: 0 }
const inv = (id: string, unit: string): CaseInventory => ({
  steps: [{ id, path: ['P', 'Weld'], name: 'Weld', type: 'operation', costs: { ...noCost }, laborHours: null }],
  flows: [{ stepId: id, substance: 'Argon', dir: 'input', quantity: 5, unit }],
})

describe('Compare (lib/compare/diff) reads units as the engine does', () => {
  it.each(PAIRS)("5 %s against 5 %s", (a, b) => {
    const identical = diffInventories(inv('b1', a), inv('c1', b)).identical
    expect(identical).toBe(engineSame(b, a))
  })

  it('still pairs grams with kilograms by converting', () => {
    const d = diffInventories(inv('b1', 'kg'), { ...inv('c1', 'g'), flows: [{ stepId: 'c1', substance: 'Argon', dir: 'input', quantity: 5000, unit: 'g' }] })
    expect(d.identical).toBe(true)
  })

  it('never calls 5 mg and 5 Mg the same amount', () => {
    const d = diffInventories(inv('b1', 'mg'), inv('c1', 'Mg'))
    expect(d.identical).toBe(false)
  })
})

describe('Ingest mapping (convertIngestUnit) reads units as the engine does', () => {
  it("does not read 'Mg' as milligrams: passed through, loudly", () => {
    const r = convertIngestUnit(5, 'Mg', 'Argon')
    expect(r).toMatchObject({ quantity: 5, unit: 'Mg' })
    expect(r.note).toMatch(/NO CONVERSION RULE/)
    expect(r.note).toMatch(/ambiguous/)
  })

  it("does not read 'mwh' as megawatt-hours", () => {
    const r = convertIngestUnit(2, 'mwh', 'Electricity')
    expect(r).toMatchObject({ quantity: 2, unit: 'mwh' })
    expect(r.note).toMatch(/NO CONVERSION RULE/)
  })

  it("reads 'm³' as m3 and 'MWh' / 'KWH' by their canonical names", () => {
    expect(convertIngestUnit(3, 'm³', 'Water')).toMatchObject({ quantity: 3, unit: 'm3' })
    expect(convertIngestUnit(3, 'm³', 'Water').note).not.toMatch(/NO CONVERSION RULE/)
    expect(convertIngestUnit(2, 'MWh', 'Electricity')).toMatchObject({ quantity: 2, unit: 'MWh' })
    expect(convertIngestUnit(7, 'KWH', 'Electricity')).toMatchObject({ quantity: 7, unit: 'kWh' })
  })

  it('converts masses to kg and volumes to m3 with the engine factors', () => {
    for (const [q, u, to] of [[5, 'mg', 'kg'], [90000, 'lbs', 'kg'], [2, 't', 'kg'], [5, 'Tgal', 'm3'], [10, 'gal', 'm3'], [250, 'L', 'm3']] as const) {
      const r = convertIngestUnit(q, u, 'Thing')
      expect(r.unit).toBe(to)
      expect(r.quantity).toBeCloseTo(convertQuantity(q, u, to)!.quantity, 12)
    }
  })

  it('keeps the natural-gas heat-content rule, whatever the MMBtu spelling', () => {
    expect(convertIngestUnit(10, 'MMBTU', 'Natural Gas')).toMatchObject({ unit: 'm3' })
    expect(convertIngestUnit(10, 'MMBtu', 'Natural Gas').quantity).toBeCloseTo(282.63, 9)
  })
})
