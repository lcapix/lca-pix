// What a step cost is made of (migrate-035, E14).
import { describe, expect, it } from 'vitest'
import {
  CostBasisInput,
  changedCostKinds,
  costAmount,
  scaleCostLines,
  stepCostBasis,
  vintageOf,
} from '@/lib/costs/cost-basis'
import { buildRunSnapshot } from '@/lib/run-snapshot'

describe('costAmount and vintageOf', () => {
  it('0.015 h x $25.83/h = $0.38745, kept to 6 decimals', () => {
    expect(costAmount(0.015, 25.83)).toBe(0.38745)
    expect(costAmount(1 / 3, 1)).toBe(0.333333)
  })
  it('reads a vintage from an effective date', () => {
    expect(vintageOf('2026-06-01')).toBe('2026-06')
    expect(vintageOf('2025')).toBe('2025')
    expect(vintageOf('soon')).toBeNull()
    expect(vintageOf(null)).toBeNull()
  })
})

describe('CostBasisInput', () => {
  const ok = (body: unknown) => CostBasisInput.safeParse(body).success
  it('a lookup names the driver, the code and the region; no rate is accepted from the caller', () => {
    expect(ok({ kind: 'labor', mode: 'lookup', driver_quantity: 0.015, rate_code: '51-4121', region: 'MI' })).toBe(true)
    expect(ok({ kind: 'labor', mode: 'lookup', driver_quantity: 0.015, rate_code: '51-4121', region: 'MI', rate: 99 })).toBe(false)
    expect(ok({ kind: 'material', mode: 'lookup', driver_quantity: 1, rate_code: 'x', region: 'US' })).toBe(false)
  })
  it('an own rate is driver x rate, or an amount alone, never both or half', () => {
    expect(ok({ kind: 'labor', mode: 'entered', driver_quantity: 0.015, rate: 30 })).toBe(true)
    expect(ok({ kind: 'overhead', mode: 'entered', amount: 0.12, source_name: 'Shop overhead 2025' })).toBe(true)
    expect(ok({ kind: 'labor', mode: 'entered', driver_quantity: 0.015, rate: 30, amount: 0.45 })).toBe(false)
    expect(ok({ kind: 'labor', mode: 'entered', rate: 30 })).toBe(false)
    expect(ok({ kind: 'labor', mode: 'entered' })).toBe(false)
    expect(ok({ kind: 'labor', mode: 'entered', amount: -1 })).toBe(false)
    expect(ok({ kind: 'labor', mode: 'entered', amount: 1, source_kind: 'live' })).toBe(false)
  })
})

describe('changedCostKinds', () => {
  const before = { labor_cost: '0.387450', labor_hours: '0.015', labor_occupation: '51-4121', energy_cost: null, material_cost: '1.20' }
  it('an editor resending unchanged values drops nothing', () => {
    expect(changedCostKinds(before, [['labor_cost', 0.38745], ['labor_hours', '0.015'], ['material_cost', 1.2], ['energy_cost', null]])).toEqual([])
  })
  it('a changed amount, hours or occupation unexplains that cost only', () => {
    expect(changedCostKinds(before, [['material_cost', 1.3]])).toEqual(['material'])
    expect(changedCostKinds(before, [['labor_hours', 0.02]])).toEqual(['labor'])
    expect(changedCostKinds(before, [['labor_occupation', '51-4041']])).toEqual(['labor'])
    expect(changedCostKinds(before, [['energy_cost', 0.01], ['labor_cost', null]])).toEqual(['labor', 'energy'])
  })
})

describe('scaleCostLines', () => {
  it('multiplies every line quantity and leaves the rates alone', () => {
    const out = JSON.parse(scaleCostLines([{ label: 'Electricity', quantity: 0.4, rate: 0.0862 }], 2)!)
    expect(out).toEqual([{ label: 'Electricity', quantity: 0.8, rate: 0.0862 }])
    expect(scaleCostLines(null, 2)).toBeNull()
    expect(scaleCostLines('not json', 2)).toBeNull()
  })
})

describe('a run keeps how each cost was built', () => {
  const component = { component_id: 7, component_name: '20. Weld tab', component_type: 'operation', hierarchy_level: 4, labor_cost: '0.387450', energy_cost: '0.010344' }
  const rows = [
    { component_id: 7, cost_kind: 'energy', driver_quantity: 0.12, driver_unit: 'kWh', rate: 0.0862, rate_unit: '$/kWh', rate_label: 'Electricity', rate_code: 'electricity', region: 'US', source_kind: 'reference', source_name: 'Reference', vintage: '2026-06', cost_lines: null },
    { component_id: 7, cost_kind: 'labor', driver_quantity: 0.015, driver_unit: 'h', rate: 25.83, rate_unit: '$/h', rate_label: 'Welders/cutters', rate_code: '51-4121', region: 'US', source_kind: 'reference', source_name: 'Reference', vintage: '2026-06', cost_lines: null },
    { component_id: 8, cost_kind: 'labor', source_kind: 'entered' },
  ]
  it('stepCostBasis keeps this step, in kind order, with the amount beside each', () => {
    const b = stepCostBasis(component, rows)
    expect(b.map((x) => x.kind)).toEqual(['labor', 'energy'])
    expect(b[0]).toMatchObject({ amount: 0.38745, driver_quantity: 0.015, rate: 25.83, rate_label: 'Welders/cutters', source_kind: 'reference', vintage: '2026-06' })
  })
  it('the snapshot step carries cost_basis', () => {
    const result: any = { component_results: [], total_impacts: [], warnings: [], summary: {}, algorithm_steps: [] }
    const snap = buildRunSnapshot(result, 'TRACI 2.1', 'US', null, { components: [component], flows: [], costBasis: rows })
    expect(snap.steps?.[0].cost_basis?.map((x) => `${x.kind} ${x.amount} ${x.source_kind}`)).toEqual([
      'labor 0.38745 reference',
      'energy 0.010344 reference',
    ])
  })
})
