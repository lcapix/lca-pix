import { describe, it, expect } from 'vitest'
import { componentCostUSD, summarizeCaseCosts } from '@/lib/case-tree-adapter'

describe('componentCostUSD (PROJ-4)', () => {
  it('adds mysql2 DECIMAL strings as numbers, not text', () => {
    expect(componentCostUSD({ labor_cost: '10.50', energy_cost: '2.25' })).toBe(12.75)
  })

  it('uses the itemized costs when there are any, else opex + capex (the canvas rule)', () => {
    expect(componentCostUSD({ labor_cost: '5.00', opex: '100.00', capex: '40.00' })).toBe(5)
    expect(componentCostUSD({ opex: '100.00', capex: '40.00' })).toBe(140)
    expect(componentCostUSD({})).toBe(0)
  })

  it('ignores the non-existent *_usd fields the modal used to read', () => {
    expect(componentCostUSD({ operational_cost_usd: 9, capital_cost_usd: 9 } as any)).toBe(0)
  })
})

describe('summarizeCaseCosts (PROJ-4)', () => {
  it('buckets itemized costs and counts opex only for steps with none itemized', () => {
    const s = summarizeCaseCosts([
      { labor_cost: '10.50', energy_cost: '2.25', opex: '100.00' },
      { opex: '7.00', capex: '500.00' },
      { material_cost: '3', transportation_cost: '1', equipment_cost: '2', overhead_cost: '4' },
    ])
    expect(s).toEqual({ labor: 10.5, energy: 2.25, material: 3, overhead: 14, total: 29.75 })
  })

  it('is null when there is no cost data', () => {
    expect(summarizeCaseCosts([{}, { capex: '10' }])).toBeNull()
  })
})
