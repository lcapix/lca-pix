import { describe, expect, it } from 'vitest'

import { diffInventories, diffScope, type CaseInventory, type InventoryStep } from '@/lib/compare/diff'
import { changeBreakdown, costImpact, hotspotMatrix, resultsTable, type CaseResult } from '@/lib/compare/analytics'

const noCost = { material: 0, labor: 0, energy: 0, transportation: 0, equipment: 0, overhead: 0, opex: 0, capex: 0 }
const step = (id: string, name: string, costs: Partial<typeof noCost> = {}, laborHours: number | null = null): InventoryStep => ({
  id,
  path: ['Touring bike', 'Fabrication', name],
  name,
  type: 'operation',
  costs: { ...noCost, ...costs },
  laborHours,
})

// The touring bike's base, trimmed to the steps the copies touch.
const base: CaseInventory = {
  steps: [
    step('b10', '10. Cut & miter frame tubes', { material: 85, labor: 6.3 }, 0.25),
    step('b20', '20. TIG weld main triangle', { material: 0.28, labor: 20.66 }, 0.8),
    step('b40', '40. Powder coat frame', { material: 0.54, labor: 8.4 }),
    step('b50', '50. Cure coating', { labor: 8.4 }),
    step('b70', '70. Final assembly', { material: 407, labor: 18.6 }),
  ],
  flows: [
    { stepId: 'b10', substance: 'Aluminum', dir: 'input', quantity: 2.2, unit: 'kg' },
    { stepId: 'b10', substance: 'Electricity', dir: 'input', quantity: 0.165, unit: 'kWh' },
    { stepId: 'b20', substance: 'Aluminum', dir: 'input', quantity: 0.03, unit: 'kg' },
    { stepId: 'b40', substance: 'Epoxy resin', dir: 'input', quantity: 0.045, unit: 'kg' },
    { stepId: 'b50', substance: 'Electricity', dir: 'input', quantity: 1.24, unit: 'kWh' },
    { stepId: 'b70', substance: 'Aluminum', dir: 'input', quantity: 0.769, unit: 'kg' },
    { stepId: 'b70', substance: 'Aluminum', dir: 'input', quantity: 0.322, unit: 'kg' },
    { stepId: 'b70', substance: 'Steel', dir: 'input', quantity: 1.02, unit: 'kg' },
  ],
}

// A copy with new ids, as Duplicate makes it.
const copyOf = (inv: CaseInventory): CaseInventory => ({
  steps: inv.steps.map((s) => ({ ...s, id: s.id.replace('b', 'c'), costs: { ...s.costs } })),
  flows: inv.flows.map((f) => ({ ...f, stepId: f.stepId.replace('b', 'c') })),
})

describe('diffInventories', () => {
  it('finds nothing in an untouched copy, even with the flows in another order and grams for kilograms', () => {
    const copy = copyOf(base)
    copy.flows.reverse()
    copy.flows = copy.flows.map((f) => (f.substance === 'Aluminum' && f.quantity === 2.2 ? { ...f, quantity: 2200, unit: 'g' } : f))
    expect(diffInventories(base, copy).identical).toBe(true)
  })

  it('reads two material swaps and says the costs did not follow', () => {
    // Shreya's "Touring bike - region" copy: brass for the weld wire, flat glass for the powder.
    const copy = copyOf(base)
    copy.flows = copy.flows.map((f) =>
      f.stepId === 'c20' ? { ...f, substance: 'Brass' } : f.stepId === 'c40' ? { ...f, substance: 'Glass, flat' } : f,
    )
    const d = diffInventories(base, copy)
    expect(d.flows).toEqual([
      { kind: 'swapped', step: '20. TIG weld main triangle', from: { substance: 'Aluminum', dir: 'input', quantity: 0.03, unit: 'kg' }, to: { substance: 'Brass', dir: 'input', quantity: 0.03, unit: 'kg' } },
      { kind: 'swapped', step: '40. Powder coat frame', from: { substance: 'Epoxy resin', dir: 'input', quantity: 0.045, unit: 'kg' }, to: { substance: 'Glass, flat', dir: 'input', quantity: 0.045, unit: 'kg' } },
    ])
    expect(d.costUnchanged).toEqual(['20. TIG weld main triangle', '40. Powder coat frame'])
    expect(d.identical).toBe(false)
  })

  it('reads the steel frame swap with its new mass and cost', () => {
    const copy = copyOf(base)
    copy.flows = copy.flows.map((f) => (f.stepId === 'c10' && f.substance === 'Aluminum' ? { ...f, substance: 'Steel', quantity: 2.34 } : f))
    copy.steps = copy.steps.map((s) => (s.id === 'c10' ? { ...s, costs: { ...s.costs, material: 60 } } : s))
    const d = diffInventories(base, copy)
    expect(d.flows).toHaveLength(1)
    expect(d.flows[0]).toMatchObject({ kind: 'swapped', from: { substance: 'Aluminum', quantity: 2.2 }, to: { substance: 'Steel', quantity: 2.34 } })
    expect(d.costs).toEqual([{ step: '10. Cut & miter frame tubes', kind: 'material', from: 85, to: 60 }])
    expect(d.costUnchanged).toEqual([])
  })

  it('pairs a changed amount with the closest line when a step has several of one material', () => {
    const copy = copyOf(base)
    copy.flows = copy.flows.map((f) => (f.stepId === 'c70' && f.quantity === 0.322 ? { ...f, quantity: 0.3 } : f))
    const d = diffInventories(base, copy)
    expect(d.flows).toEqual([
      { kind: 'changed', step: '70. Final assembly', from: { substance: 'Aluminum', dir: 'input', quantity: 0.322, unit: 'kg' }, to: { substance: 'Aluminum', dir: 'input', quantity: 0.3, unit: 'kg' } },
    ])
  })

  it('lists added and removed exchanges and steps, and changed labor hours', () => {
    const copy = copyOf(base)
    copy.flows = copy.flows.filter((f) => !(f.stepId === 'c50'))
    copy.flows.push({ stepId: 'c10', substance: 'Transport, ocean freight', dir: 'input', quantity: 25.6476, unit: 'tkm' })
    copy.steps = copy.steps.map((s) => (s.id === 'c20' ? { ...s, laborHours: 0.6 } : s))
    copy.steps.push(step('c90', '90. Ship to dealer'))
    const d = diffInventories(base, copy)
    expect(d.flows).toEqual(
      expect.arrayContaining([
        { kind: 'added', step: '10. Cut & miter frame tubes', to: { substance: 'Transport, ocean freight', dir: 'input', quantity: 25.6476, unit: 'tkm' } },
        { kind: 'removed', step: '50. Cure coating', from: { substance: 'Electricity', dir: 'input', quantity: 1.24, unit: 'kWh' } },
      ]),
    )
    expect(d.steps).toEqual([{ kind: 'added', step: '90. Ship to dealer', path: ['Touring bike', 'Fabrication', '90. Ship to dealer'] }])
    expect(d.hours).toEqual([{ step: '20. TIG weld main triangle', from: 0.8, to: 0.6 }])
  })

  it('never calls an energy line a swap for a material line', () => {
    const copy = copyOf(base)
    copy.flows = copy.flows.filter((f) => !(f.stepId === 'c40'))
    copy.flows.push({ stepId: 'c40', substance: 'Electricity', dir: 'input', quantity: 0.045, unit: 'kWh' })
    const kinds = diffInventories(base, copy).flows.map((f) => f.kind).sort()
    expect(kinds).toEqual(['added', 'removed'])
  })
})

describe('diffScope', () => {
  const scope = { method: 'TRACI 2.1', region: 'US', functionalUnit: '1 touring bicycle, at the factory gate', boundary: 'cradle-to-gate', referenceFlow: 1, referenceFlowUnit: null, modeledOutput: 1 }
  it('reports only what differs', () => {
    expect(diffScope(scope, { ...scope })).toEqual([])
    expect(diffScope({ ...scope, region: 'EU' }, scope)).toEqual([{ label: 'Region (electricity grid)', base: 'EU', other: 'US' }])
  })
})

// Global Warming by step and by material, runs 173 (base, US) and 176 (brass and glass copy, US).
const bikeBase: CaseResult = {
  caseId: '209',
  name: 'Touring bike',
  totals: [
    { category: 'Global Warming', unit: 'kg CO2 eq', value: 88.62057 },
    { category: 'Acidification', unit: 'kg SO2 eq', value: 0.007334 },
  ],
  byStep: [
    { step: '70. Final assembly', category: 'Global Warming', value: 41.58 },
    { step: '60. Build & true wheels', category: 'Global Warming', value: 22.88 },
    { step: '10. Cut & miter frame tubes', category: 'Global Warming', value: 19.18 },
    { step: '80. QA & pack', category: 'Global Warming', value: 3.14832 },
    { step: '40. Powder coat frame', category: 'Global Warming', value: 0.858 },
    { step: '20. TIG weld main triangle', category: 'Global Warming', value: 0.3833 },
    { step: '50. Cure coating', category: 'Global Warming', value: 0.434 },
    { step: '30. Weld dropouts & bosses', category: 'Global Warming', value: 0.15825 },
  ],
  flows: [
    { step: '20. TIG weld main triangle', substance: 'Aluminum', category: 'Global Warming', value: 0.258 },
    { step: '40. Powder coat frame', substance: 'Epoxy resin', category: 'Global Warming', value: 0.27 },
    { step: '70. Final assembly', substance: 'Aluminum', category: 'Global Warming', value: 33.84 },
  ],
  costs: [{ step: '10. Cut & miter frame tubes', material: 85, labor: 6.3, energy: 0.01, transportation: 0, equipment: 0, overhead: 0, opex: 0, capex: 0 }],
}
const bikeCopy: CaseResult = {
  ...bikeBase,
  caseId: '212',
  name: 'Touring bike - region',
  totals: [
    { category: 'Global Warming', unit: 'kg CO2 eq', value: 88.18875 },
    { category: 'Acidification', unit: 'kg SO2 eq', value: 0.007334 },
  ],
  byStep: bikeBase.byStep.map((r) =>
    r.step.startsWith('20.') ? { ...r, value: r.value - 0.258 + 0.03183 } : r.step.startsWith('40.') ? { ...r, value: r.value - 0.27 + 0.06435 } : r,
  ),
  flows: [
    { step: '20. TIG weld main triangle', substance: 'Brass', category: 'Global Warming', value: 0.03183 },
    { step: '40. Powder coat frame', substance: 'Glass, flat', category: 'Global Warming', value: 0.06435 },
    { step: '70. Final assembly', substance: 'Aluminum', category: 'Global Warming', value: 33.84 },
  ],
}

describe('comparison analytics', () => {
  it('tabulates every category with the change against the base', () => {
    const rows = resultsTable([bikeBase, bikeCopy], '209')
    const gw = rows.find((r) => r.category === 'Global Warming')!
    expect(gw.cells[0]).toMatchObject({ value: 88.62057, delta: null, relMax: 100 })
    expect(gw.cells[1].delta).toBeCloseTo(-0.43182, 5)
    expect(gw.cells[1].deltaPct).toBeCloseTo(-0.4873, 3)
    expect(rows.find((r) => r.category === 'Acidification')!.cells[1].delta).toBe(0)
  })

  it('puts the whole change on the two swapped steps and the four materials', () => {
    const bySteps = changeBreakdown(bikeBase, bikeCopy, 'Global Warming', 'step')
    expect(bySteps.rows.map((r) => r.key)).toEqual(['20. TIG weld main triangle', '40. Powder coat frame'])
    expect(bySteps.rows.reduce((s, r) => s + r.delta, 0)).toBeCloseTo(bySteps.delta, 9)

    const byMaterial = changeBreakdown(bikeBase, bikeCopy, 'Global Warming', 'material')
    expect(byMaterial.rows.map((r) => r.key)).toEqual(['Epoxy resin', 'Aluminum', 'Glass, flat', 'Brass'])
    expect(byMaterial.rows.reduce((s, r) => s + r.delta, 0)).toBeCloseTo(-0.43182, 5)
  })

  it('marks the steps over the threshold as hotspots', () => {
    const m = hotspotMatrix([bikeBase], 'Global Warming', 'step', 10)
    expect(m.rows.filter((r) => r.cells[0].hot).map((r) => r.key)).toEqual([
      '70. Final assembly',
      '60. Build & true wheels',
      '10. Cut & miter frame tubes',
    ])
    expect(m.rows[0].cells[0].share).toBeCloseTo(46.92, 1)
  })

  it('gives no cost per unit avoided when the cost did not move', () => {
    const ci = costImpact(bikeBase, bikeCopy, 'Global Warming')
    expect(ci.costDelta).toBe(0)
    expect(ci.impactDelta).toBeCloseTo(-0.43182, 5)
    expect(ci.costPerUnitAvoided).toBeNull()
    const cheaper = { ...bikeCopy, costs: [{ ...bikeBase.costs[0], material: 60 }] }
    expect(costImpact(bikeBase, cheaper, 'Global Warming').costPerUnitAvoided).toBeCloseTo(-25 / 0.43182, 3)
  })
})
