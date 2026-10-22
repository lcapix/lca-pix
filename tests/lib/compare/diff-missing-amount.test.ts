import { describe, expect, it } from 'vitest'

import { diffInventories, type CaseInventory } from '@/lib/compare/diff'

const step = (id: string, name: string) => ({
  id,
  path: ['Bracket', name],
  name,
  type: 'operation',
  costs: { material: 0, labor: 0, energy: 0, transportation: 0, equipment: 0, overhead: 0, opex: 0, capex: 0 },
  laborHours: null,
})
const inv = (quantity: number | null, other: Array<{ substance: string; quantity: number | null; unit: string }> = []): CaseInventory => ({
  steps: [step('s1', 'Deburr edges')],
  flows: [
    { stepId: 's1', substance: 'Electricity', dir: 'input', quantity, unit: 'kWh' },
    ...other.map((o) => ({ stepId: 's1', dir: 'input' as const, ...o })),
  ],
})

describe('what differs when a flow has no amount', () => {
  it('reads "no amount" on both sides as unchanged', () => {
    const d = diffInventories(inv(null), inv(null))
    expect(d.flows).toEqual([])
  })

  it('reads an amount filled in as a change, not as a change from zero', () => {
    const d = diffInventories(inv(null), inv(0.0013))
    expect(d.flows).toHaveLength(1)
    expect(d.flows[0]).toMatchObject({ kind: 'changed', from: { quantity: null }, to: { quantity: 0.0013 } })
  })

  it('reads an amount cleared as a change too', () => {
    const d = diffInventories(inv(0.0013), inv(null))
    expect(d.flows[0]).toMatchObject({ kind: 'changed', from: { quantity: 0.0013 }, to: { quantity: null } })
  })

  it('still reads real amounts the old way', () => {
    expect(diffInventories(inv(0.4), inv(0.4)).flows).toEqual([])
    expect(diffInventories(inv(0.4), inv(0.25)).flows[0]).toMatchObject({ kind: 'changed' })
  })
})

describe('own factors (migrate-034) in what differs', () => {
  const step = { id: 's', path: ['Bracket', '10. Cut blank'], name: '10. Cut blank', type: 'operation', costs: {} as any, laborHours: null }
  const steel = (ownFactor: string | null, quantity = 0.8) => ({ stepId: 's', substance: 'Steel', dir: 'input' as const, quantity, unit: 'kg', ownFactor })
  it('a factor set by hand on an unchanged amount is a Factor change, so the cases are not identical', () => {
    const d = diffInventories({ steps: [step], flows: [steel(null)] }, { steps: [step], flows: [steel('Global Warming 2 kg CO2 eq / kg')] })
    expect(d.identical).toBe(false)
    expect(d.flows).toEqual([
      { kind: 'factor', step: '10. Cut blank', flow: expect.objectContaining({ substance: 'Steel' }), from: null, to: 'Global Warming 2 kg CO2 eq / kg' },
    ])
  })
  it('an amount and a factor both changed read as two changes; the same factor on both sides is none', () => {
    const d = diffInventories({ steps: [step], flows: [steel('Global Warming 2 kg CO2 eq / kg')] }, { steps: [step], flows: [steel(null, 0.7)] })
    expect(d.flows.map((f) => f.kind)).toEqual(['changed', 'factor'])
    const same = diffInventories({ steps: [step], flows: [steel('Global Warming 2 kg CO2 eq / kg')] }, { steps: [step], flows: [steel('Global Warming 2 kg CO2 eq / kg')] })
    expect(same.identical).toBe(true)
  })
})
