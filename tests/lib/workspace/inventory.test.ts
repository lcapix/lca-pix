import { describe, expect, it } from 'vitest'
import { buildInventory, calculatorFits, changedFlowCount, flowStatus, inventoryBadge, machineKwh, sourceKindOf, statusCounts } from '@/lib/workspace/inventory'
import { amount } from '@/lib/ui/format'

describe('flowStatus: the four phrases', () => {
  const base = { unit: 'kg', substance_unit: 'kg', excluded: false, climate: true }
  it('no amount first, then a unit that cannot convert, then counted or no factor', () => {
    expect(flowStatus({ ...base, quantity: null })).toBe('needs_amount')
    expect(flowStatus({ ...base, quantity: 1, unit: 'roll' })).toBe('left_out')
    expect(flowStatus({ ...base, quantity: 1, excluded: true })).toBe('left_out')
    expect(flowStatus({ ...base, quantity: 1 })).toBe('counted')
    expect(flowStatus({ ...base, quantity: 0.02, climate: false })).toBe('no_factor')
    expect(flowStatus({ ...base, quantity: 800, unit: 'g' })).toBe('counted')
  })
})

describe('sourceKindOf', () => {
  it('entered by hand, supplier EPD, regional, global average', () => {
    expect(sourceKindOf({ scope: 'Entered by hand', source: 'Entered by hand: bill' })).toBe('hand')
    expect(sourceKindOf({ scope: 'Global', source: 'Supplier EPD S-P-01234 (EN 15804)' })).toBe('supplier')
    expect(sourceKindOf({ scope: 'US', source: 'EPA eGRID 2023' })).toBe('regional')
    expect(sourceKindOf({ scope: 'Global', source: 'worldsteel 2022' })).toBe('global')
    expect(sourceKindOf({ scope: null, source: null })).toBe('global')
  })
})

describe('buildInventory', () => {
  const flows = [
    { flow_id: 1, component_id: 10, substance_id: 3298, substance_name: 'Steel', substance_unit: 'kg', flow_type: 'input' as const, quantity: 0.8, unit: 'kg' },
    { flow_id: 2, component_id: 10, substance_id: 7, substance_name: 'Electricity', substance_unit: 'kWh', flow_type: 'input' as const, quantity: 0.05, unit: 'kWh' },
    { flow_id: 3, component_id: 20, substance_id: 9, substance_name: 'Argon', substance_unit: 'kg', flow_type: 'input' as const, quantity: 0.02, unit: 'kg' },
    { flow_id: 4, component_id: 30, substance_id: 11, substance_name: 'Packaging tape', substance_unit: 'kg', flow_type: 'input' as const, quantity: 1, unit: 'roll' },
    { flow_id: 5, component_id: 30, substance_id: 7, substance_name: 'Electricity', substance_unit: 'kWh', flow_type: 'input' as const, quantity: null, unit: 'kWh' },
  ]
  const contribution = (flow_id: number, factor: number, impact: number, scope: string, source: string) => ({
    flow_id, substance_id: 0, substance_name: '', cas_number: null, flow_type: 'input' as const, quantity: 0, unit: '',
    characterization_factor: factor, impact_contribution: impact, category_id: 1, category_name: 'Global Warming',
    geographic_scope: scope, factor_source: source,
  })
  const result = {
    component_results: [
      {
        component_id: 10, component_name: '10. Cut blank', component_type: 'operation', hierarchy_level: 4, warnings: [],
        total_flows_processed: 2, driver_flows_count: 2,
        impacts: [{ category_id: 1, category_name: 'Global Warming', impact_value: 1.5375, unit: 'kg CO2 eq', flow_count: 2 }],
        flow_contributions: [contribution(1, 1.9, 1.52, 'Global', 'worldsteel 2022'), contribution(2, 0.35, 0.0175, 'US', 'EPA eGRID 2023')],
      },
    ],
  } as any
  const rows = buildInventory(flows, result)

  it('a counted row carries amount × factor = impact and its tag', () => {
    expect(rows[0]).toMatchObject({ status: 'counted', amount: 0.8, climate: { factor: 1.9, impact: 1.52, tag: 'global', unit: 'kg CO2 eq' } })
    expect(rows[1].climate).toMatchObject({ factor: 0.35, tag: 'regional' })
    expect(rows[0].amount! * rows[0].climate!.factor).toBeCloseTo(rows[0].climate!.impact, 12)
  })
  it('no factor, unit left out, needs an amount', () => {
    expect(rows.map((r) => r.status)).toEqual(['counted', 'counted', 'no_factor', 'left_out', 'needs_amount'])
    expect(rows[2].climate).toBeNull()
    expect(statusCounts(rows)).toEqual({ all: 5, counted: 2, no_factor: 1, needs_amount: 1, left_out: 1 })
  })
})

describe('changedFlowCount (Out of date)', () => {
  const f = (flow_id: number, amount: number | null, over: Record<string, unknown> = {}) => ({ flow_id, substance: 'Electricity', direction: 'input', amount, unit: 'kWh', ...over })
  it('counts added, removed and changed flows; nothing changed is 0', () => {
    expect(changedFlowCount([f(1, 0.4), f(2, 0.12)], [f(1, 0.4), f(2, 0.12)])).toBe(0)
    expect(changedFlowCount([f(1, 0.4), f(2, 0.12)], [f(1, 0.25), f(2, 0.12)])).toBe(1)
    expect(changedFlowCount([f(1, 0.4), f(2, 0.12)], [f(1, 0.4), f(3, 1)])).toBe(2)
    expect(changedFlowCount([f(1, 0.4)], [f(1, 0.4, { unit: 'MJ' })])).toBe(1)
    expect(changedFlowCount([f(1, null)], [f(1, 0.4)])).toBe(1)
    expect(changedFlowCount(null, [f(1, 0.4)])).toBe(0)
  })
})

describe('the machine calculator and the tab badge (E04, rules.md)', () => {
  it('0.75 kW × 8 s × 80% = 0.0013 kWh; bad input gives nothing', () => {
    expect(amount(machineKwh(0.75, 8, 80)!)).toBe('0.0013')
    expect(machineKwh(1, 3600, 100)).toBe(1)
    expect(machineKwh(-1, 8, 80)).toBeNull()
    expect(machineKwh(1, 8, 120)).toBeNull()
    expect(machineKwh(NaN, 8, 80)).toBeNull()
    expect(calculatorFits({ unit: 'kWh' })).toBe(true)
    expect(calculatorFits({ unit: 'MJ' })).toBe(true)
    expect(calculatorFits({ unit: 'kg' })).toBe(false)
  })
  it('the Inventory tab says what needs doing, in the design words', () => {
    expect(inventoryBadge({ needs_amount: 2, left_out: 0 })).toBe('2 need an amount')
    expect(inventoryBadge({ needs_amount: 1, left_out: 1 })).toBe('1 needs an amount · 1 left out')
    expect(inventoryBadge({ needs_amount: 0, left_out: 0 })).toBeNull()
  })
})
