/**
 * When the panels offer a step's cost from its flows, and how they say it
 * (E14): an empty cost or one from the flows that changed gets "Use it"; a
 * number by hand gets it too ("now $0.50"); a looked-up energy price is not
 * second-guessed; unpriced flows are named only while the cost is empty or
 * from the flows.
 */
import { describe, expect, it } from 'vitest'
import { basisLine } from '@/lib/workspace/cost-text'
import { costedInLine, flowCostNotes, noPriceText, offerText, type FromFlows } from '@/lib/workspace/flow-cost-text'

const steel = { label: 'Steel', quantity: 0.8, unit: 'kg', rate: 0.95, rate_unit: '$/kg', source_kind: 'reference' as const, source_name: 'Steel, hot-rolled', vintage: '2026-06' }
const power = { label: 'Electricity', quantity: 2.5, unit: 'kWh', rate: 0.0862, rate_unit: '$/kWh', source_kind: 'reference' as const, source_name: 'Electricity', vintage: '2026-06' }

const flows = (material: number | null, energy: number | null, noPrice: string[] = []): FromFlows => ({
  material: { kind: 'material', amount: material, lines: material === null ? [] : [steel], noPrice },
  energy: { kind: 'energy', amount: energy, lines: energy === null ? [] : [power], noPrice: [] },
})
const cost = (kind: 'material' | 'energy', amount: number | null, basis: { rate_code: string | null; source_kind: 'reference' | 'live' | 'entered' } | null = null) => ({
  kind,
  amount,
  basis: basis as any,
})

describe('flowCostNotes', () => {
  it('an empty cost: offers the flows\' number and names the unpriced flows', () => {
    expect(flowCostNotes([cost('material', null), cost('energy', null)], flows(0.76, null, ['Argon']))).toEqual([
      { kind: 'material', offer: 0.76, stored: null, noPrice: ['Argon'] },
    ])
  })

  it('a cost from the flows: nothing while they agree, an update once a flow changed', () => {
    const fromFlows = { rate_code: 'flows', source_kind: 'reference' as const }
    expect(flowCostNotes([cost('material', 0.76, fromFlows)], flows(0.76, null))).toEqual([])
    expect(flowCostNotes([cost('material', 0.76, fromFlows)], flows(0.95, null, ['Argon']))).toEqual([
      { kind: 'material', offer: 0.95, stored: 0.76, noPrice: ['Argon'] },
    ])
  })

  it('a number by hand, or one with no basis: offered with "now"; the unpriced flows are taken as included', () => {
    expect(flowCostNotes([cost('material', 0.5, { rate_code: null, source_kind: 'entered' })], flows(0.76, null, ['Argon']))).toEqual([
      { kind: 'material', offer: 0.76, stored: 0.5, noPrice: [] },
    ])
    expect(flowCostNotes([cost('material', 0.03)], flows(0.76, null))).toEqual([{ kind: 'material', offer: 0.76, stored: 0.03, noPrice: [] }])
  })

  it('an energy price someone looked up is not second-guessed by the reference table', () => {
    expect(flowCostNotes([cost('energy', 0.19, { rate_code: 'electricity', source_kind: 'live' })], flows(null, 0.2155))).toEqual([])
    expect(flowCostNotes([cost('energy', null)], flows(null, 0.2155))).toEqual([{ kind: 'energy', offer: 0.2155, stored: null, noPrice: [] }])
  })

  it('a kind a step above or below carries already: no offer and no names (it would count twice)', () => {
    const inLine = (kind: string) => (kind === 'material' ? ['Shear blank'] : [])
    expect(flowCostNotes([cost('material', null), cost('energy', null)], flows(0.76, 0.2155, ['Argon']), inLine)).toEqual([
      { kind: 'energy', offer: 0.2155, stored: null, noPrice: [] },
    ])
  })

  it('under half a cent from the flows and nothing stored: nothing to offer', () => {
    expect(flowCostNotes([cost('energy', null)], flows(null, 0.00431))).toEqual([])
  })

  it('no answer from the flows (an older server): nothing', () => {
    expect(flowCostNotes([cost('material', null)], undefined)).toEqual([])
  })
})

describe('the words', () => {
  it('offerText', () => {
    expect(offerText({ kind: 'material', offer: 0.76, stored: null })).toBe('Material cost from these flows: $0.76')
    expect(offerText({ kind: 'energy', offer: 0.2155, stored: 0.19 })).toBe('Energy cost from these flows: $0.22 (now $0.19)')
  })

  it('noPriceText', () => {
    expect(noPriceText(['Argon'])).toBe('No price for Argon: add its cost')
    expect(noPriceText(['Argon', 'Packaging tape'])).toBe('No price for Argon and Packaging tape: add their cost')
    expect(noPriceText(['Argon', 'Packaging tape', 'Powder coating'])).toBe('No price for Argon, Packaging tape and Powder coating: add their cost')
  })

  it('a cost built line by line shows its lines', () => {
    const b = { driver_quantity: null, driver_unit: null, rate: null, rate_unit: null, rate_label: null, source_name: "Reference prices for the step's flows" }
    expect(basisLine({ ...b, lines: [steel, power] })).toBe('Steel 0.8 kg × $0.95/kg + Electricity 2.5 kWh × $0.0862/kWh')
    expect(basisLine({ ...b, lines: null })).toBe("Reference prices for the step's flows")
  })
})

describe('costedInLine', () => {
  // The sample's shape: 10. Cut blank holds the steel; its child Shear blank prices it.
  const none = { material: null, energy: null }
  const steps = [
    { id: 1, parentId: null, name: 'Painted steel bracket', costs: none },
    { id: 2, parentId: 1, name: 'Cutting', costs: none },
    { id: 3, parentId: 2, name: '10. Cut blank', costs: none },
    { id: 4, parentId: 3, name: 'Shear blank', costs: { material: 0.76, energy: null } },
    { id: 5, parentId: 3, name: 'Deburr edges', costs: none },
    { id: 6, parentId: 2, name: '11. Beside it', costs: { material: 0.2, energy: null } },
    { id: 7, parentId: 1, name: 'Coating line', costs: { material: null, energy: 0.03 } },
  ]
  it('finds the kind above or below, never beside', () => {
    expect(costedInLine(3, steps, 'material')).toEqual(['Shear blank'])
    expect(costedInLine(3, steps, 'energy')).toEqual([])
    expect(costedInLine(5, steps, 'material')).toEqual([])
    expect(costedInLine(4, steps, 'material')).toEqual([])
    expect(costedInLine(1, steps, 'material')).toEqual(['11. Beside it', 'Shear blank'])
  })
  it('a loop in the parents does not hang', () => {
    const loop = [
      { id: 1, parentId: 2, name: 'A', costs: none },
      { id: 2, parentId: 1, name: 'B', costs: { material: 1, energy: null } },
    ]
    expect(costedInLine(1, loop, 'material')).toEqual(['B'])
  })
})
