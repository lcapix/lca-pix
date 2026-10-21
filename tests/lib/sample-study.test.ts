import { describe, expect, it } from 'vitest'
import { SAMPLE_STEPS, TIER_LEVEL, sampleCostAmount } from '@/lib/sample/sample-study'

const sumCents = (names?: string[]) =>
  Math.round(
    SAMPLE_STEPS.filter((s) => !names || names.includes(s.name))
      .flatMap((s) => s.costs ?? [])
      .reduce((t, c) => t + sampleCostAmount(c) * 100, 0),
  ) / 100

describe('the sample study definition', () => {
  it('17 steps in five tiers, parents before children, every parent present', () => {
    expect(SAMPLE_STEPS).toHaveLength(17)
    const counts = SAMPLE_STEPS.reduce<Record<string, number>>((m, s) => ({ ...m, [s.tier]: (m[s.tier] ?? 0) + 1 }), {})
    expect(counts).toEqual({ product: 1, machine_line: 3, subprocess: 4, operation: 4, elemental_task: 5 })
    const seen = new Set<string>()
    for (const s of SAMPLE_STEPS) {
      if (s.parent) {
        expect(seen.has(s.parent), s.name).toBe(true)
        const parent = SAMPLE_STEPS.find((p) => p.name === s.parent)!
        expect(TIER_LEVEL[s.tier], s.name).toBe(TIER_LEVEL[parent.tier] + 1)
      }
      seen.add(s.name)
    }
  })

  it('nine flows, and the climate arithmetic the screens quote: 1.72 and 1.667 with the eGRID 0.350 and worldsteel 1.900 factors', () => {
    const flows = SAMPLE_STEPS.flatMap((s) => (s.flows ?? []).map((f) => ({ ...f, step: s.name })))
    expect(flows).toHaveLength(9)
    const gw = (cure: number) =>
      flows.reduce((t, f) => {
        if (f.substance === 'Steel') return t + f.quantity * 1.9
        if (f.substance === 'Electricity') return t + (f.step === '30. Powder coat and cure' ? cure : f.quantity) * 0.35
        return t
      }, 0)
    expect(gw(0.4).toFixed(2)).toBe('1.72')
    expect(gw(0.25).toFixed(3)).toBe('1.667')
  })

  it('costs: $1.75 per bracket; Weld tab $0.55 = 0.39 + 0.01 + 0.03 + 0.12', () => {
    expect(sumCents()).toBe(1.75)
    expect(sumCents(['20. Weld tab'])).toBe(0.55)
    const weld = SAMPLE_STEPS.find((s) => s.name === '20. Weld tab')!.costs!.map(sampleCostAmount)
    expect(weld).toEqual([0.39, 0.01, 0.03, 0.12])
    expect(sumCents(['Shear blank', 'Deburr edges'])).toBe(0.9)
    expect(sumCents(['Spray powder', 'Cure 20 min'])).toBe(0.21)
    expect(sumCents(['Fold and tape'])).toBe(0.09)
  })
})
