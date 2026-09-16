import { describe, expect, it } from 'vitest'

import { suggestCostsFromFlows } from '@/lib/costs/suggest-costs'

describe('suggestCostsFromFlows', () => {
  it('costs energy from the REAL flow quantity × the carrier rate', () => {
    const s = suggestCostsFromFlows([
      { substance: 'Electricity', dir: 'IN', amount: 12000, unit: 'kWh' },
      { substance: 'Coal', dir: 'IN', amount: 100, unit: 'MMBtu' },
    ])
    // 12000 × 0.13 + 100 × 2.5 = 1560 + 250
    expect(s.energy).toBe(1810)
    expect(s.grounded).toBe(true)
    expect(s.material).toBeUndefined()
  })

  it('prices material by the ACTUAL material, and converts mass units to kg', () => {
    const s = suggestCostsFromFlows([
      { substance: 'Steel, hot-rolled', dir: 'IN', amount: 45, unit: 'kg' },
      { substance: 'Aluminum, primary', dir: 'IN', amount: 2, unit: 't' }, // 2000 kg
    ])
    // 45 × 0.95 (steel) + 2000 × 2.10 (aluminum) = 42.75 + 4200
    expect(s.material).toBe(4242.75)
  })

  it('costs a transport leg from tonne-km × the modal freight rate', () => {
    const s = suggestCostsFromFlows([
      { substance: 'Transport, truck, long-haul', dir: 'IN', amount: 540, unit: 'tkm' },
      { substance: 'Transport, ocean freight', dir: 'IN', amount: 1000, unit: 'tkm' },
    ])
    // 540 × 0.12 (truck) + 1000 × 0.006 (ocean) = 64.8 + 6
    expect(s.transportation).toBe(70.8)
  })

  it('never invents labor — only costs it from real hours', () => {
    const withHours = suggestCostsFromFlows([], { nodeName: 'MIG weld', laborHours: 4 })
    expect(withHours.labor).toBe(103.32) // 4 × $25.83 welder
    const noHours = suggestCostsFromFlows([], { nodeName: 'MIG weld' })
    expect(noHours.labor).toBeUndefined()
    expect(noHours.notes.some((n) => /labor hours/i.test(n))).toBe(true)
  })

  it('surfaces flows it cannot price instead of dropping them', () => {
    const s = suggestCostsFromFlows([
      { substance: 'M6 bolt', dir: 'IN', amount: 8, unit: 'ea' },
    ])
    expect(s.material).toBeUndefined()
    expect(s.grounded).toBe(false)
    expect(s.notes.some((n) => n.includes('M6 bolt'))).toBe(true)
  })

  it('does not misprice a material named like freight as transport (regression)', () => {
    const s = suggestCostsFromFlows([
      { substance: 'Shipping crate, plywood', dir: 'IN', amount: 5, unit: 'kg' },
    ])
    expect(s.transportation).toBeUndefined() // kg, not tkm → not freight
    expect(s.material).toBeGreaterThan(0) // priced as material instead
  })

  it('ignores outputs (emissions have no cost)', () => {
    const s = suggestCostsFromFlows([
      { substance: 'Carbon Dioxide', dir: 'OUT', amount: 500, unit: 'kg' },
    ])
    expect(s.energy).toBeUndefined()
    expect(s.material).toBeUndefined()
    expect(s.transportation).toBeUndefined()
  })
})
