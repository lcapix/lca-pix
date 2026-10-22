/**
 * A person's own factor for one flow (migrate-034, E03 "Use my own number").
 */
import { describe, expect, it, vi } from 'vitest'
import {
  FactorOverrideInput,
  mergeFactorOverrides,
  methodCategoryUnit,
  overrideImpactUnit,
  type OverrideRow,
} from '@/lib/factor-override'
import { calculateComponentImpacts, summarizeDataQuality } from '@/lib/lca-engine'

const libraryRow = (over: Record<string, unknown> = {}) => ({
  flow_id: 1,
  substance_id: 1,
  substance_name: 'Steel',
  cas_number: null,
  flow_type: 'input',
  quantity: 0.8,
  flow_unit: 'kg',
  substance_default_unit: 'kg',
  category_id: 1,
  category_name: 'Global Warming',
  category_unit: 'kg CO2 eq',
  factor_unit: 'kg CO2 eq / kg',
  characterization_factor: 1.9,
  factor_basis: 'embodied',
  geographic_scope: 'Global',
  factor_source: 'worldsteel 2022 global average crude steel',
  ...over,
})

const own = (over: Partial<OverrideRow> = {}): OverrideRow => ({
  flow_id: 1,
  category_id: 1,
  category_name: 'Global Warming',
  category_unit: 'kg CO2 eq',
  factor_value: 2,
  impact_unit: 'kg CO2 eq',
  per_unit: 'kg',
  source: 'Supplier EPD 2024',
  note: null,
  method_unit: 'kg CO2 eq',
  substance_id: 1,
  substance_name: 'Steel',
  cas_number: null,
  substance_default_unit: 'kg',
  flow_type: 'input',
  quantity: 0.8,
  flow_unit: 'kg',
  ...over,
})

describe('FactorOverrideInput', () => {
  const ok = { category_id: 1, factor_value: 2.1, source: 'Supplier EPD 2024' }
  it('accepts a number with a source; per_unit and note are optional; a credit may be negative', () => {
    expect(FactorOverrideInput.safeParse(ok).success).toBe(true)
    expect(FactorOverrideInput.safeParse({ ...ok, factor_value: -0.4, per_unit: 'g', note: 'by mass' }).success).toBe(true)
  })
  it.each([
    ['no source', { category_id: 1, factor_value: 2 }],
    ['a blank source', { ...ok, source: '   ' }],
    ['a source past 255', { ...ok, source: 'x'.repeat(256) }],
    ['a note past 1000', { ...ok, note: 'x'.repeat(1001) }],
    ['a string number', { ...ok, factor_value: '2.1' }],
    ['Infinity', { ...ok, factor_value: Infinity }],
    ['an absurd value', { ...ok, factor_value: 1e13 }],
    ['category 0', { ...ok, category_id: 0 }],
    ['an unknown key', { ...ok, impact_unit: 'kg N eq' }],
  ])('refuses %s', (_label, body) => {
    expect(FactorOverrideInput.safeParse(body).success).toBe(false)
  })
})

describe('the result unit', () => {
  it("is the method's numerator when its factors agree, else null", () => {
    expect(methodCategoryUnit(['kg N eq / kg', 'kg N eq / kWh', 'kg N eq'])).toBe('kg N eq')
    expect(methodCategoryUnit(['kg Sb eq ', 'kg Sb eq / kg'])).toBe('kg Sb eq')
    expect(methodCategoryUnit(['kg N eq / kg', 'kg PO4 eq / kg'])).toBeNull()
    expect(methodCategoryUnit([])).toBeNull()
  })
  it("falls back to the category's unit when the method has no factor in it", () => {
    expect(overrideImpactUnit(null, 'kg CO2 eq')).toBe('kg CO2 eq')
    expect(overrideImpactUnit('kg N eq', 'kg PO4 eq')).toBe('kg N eq')
  })
})

describe('mergeFactorOverrides', () => {
  it('replaces the library factor for that flow and category only, tagged Entered by hand', () => {
    const acid = libraryRow({ category_id: 3, category_name: 'Acidification', factor_unit: 'kg SO2 eq / kg' })
    const { rows, warnings } = mergeFactorOverrides([libraryRow(), acid], [own()])
    expect(warnings).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.category_id === 3)).toBe(acid)
    const hand = rows.find((r) => r.category_id === 1)!
    expect(hand).toMatchObject({
      characterization_factor: 2,
      factor_unit: 'kg CO2 eq / kg',
      geographic_scope: 'Entered by hand',
      factor_source: 'Entered by hand: Supplier EPD 2024',
      factor_origin: 'hand',
      factor_basis: 'embodied',
    })
  })
  it('adds a factor where the library has none (Argon), with the note after the source', () => {
    const { rows } = mergeFactorOverrides([], [own({ substance_name: 'Argon', note: 'from the gas supplier' })])
    expect(rows).toHaveLength(1)
    expect(rows[0].factor_source).toBe('Entered by hand: Supplier EPD 2024 (from the gas supplier)')
  })
  it("an output's own factor is elementary, so the direction rule keeps it", () => {
    const { rows } = mergeFactorOverrides([], [own({ flow_type: 'output' })])
    expect(rows[0].factor_basis).toBe('elementary')
  })
  it("leaves out a number in another result unit than the method's, keeping the library row", () => {
    const lib = libraryRow({ category_id: 4, category_name: 'Eutrophication', factor_unit: 'kg N eq / kg' })
    const { rows, warnings, refused } = mergeFactorOverrides(
      [lib],
      [own({ category_id: 4, category_name: 'Eutrophication', impact_unit: 'kg PO4 eq', method_unit: 'kg N eq' })],
    )
    expect(refused).toBe(1)
    expect(rows).toEqual([lib])
    expect(warnings[0]).toMatch(/in kg PO4 eq, but this method reports Eutrophication in kg N eq\. It is LEFT OUT/)
  })
})

describe('the engine uses an own factor', () => {
  const COMPONENT = [{ component_id: 1, component_name: '10. Cut blank', component_type: 'operation', hierarchy_level: 4 }]
  const fakeConn = (sequence: any[][]) => {
    let i = 0
    return { query: vi.fn().mockImplementation(async () => [sequence[i++], null]) } as any
  }

  it('0.80 kg × own 2.0 = 1.6, in place of the 1.9 library factor, and the contribution says so', async () => {
    const overrideRow = { ...own(), method_units: 'kg CO2 eq' }
    const r = await calculateComponentImpacts(1, fakeConn([COMPONENT, [libraryRow()], [overrideRow]]), { method: 'TRACI 2.1', regionCode: 'US' })
    expect(r.impacts[0].impact_value).toBeCloseTo(1.6, 12)
    expect(r.flow_contributions).toHaveLength(1)
    expect(r.flow_contributions[0]).toMatchObject({
      characterization_factor: 2,
      geographic_scope: 'Entered by hand',
      factor_origin: 'hand',
      source_tier: 'unverified',
    })
  })

  it('converts the amount to the unit the number is per (800 g at 2.0 per kg = 1.6)', async () => {
    const overrideRow = { ...own({ quantity: 800, flow_unit: 'g' }), method_units: 'kg CO2 eq' }
    const r = await calculateComponentImpacts(
      1,
      fakeConn([COMPONENT, [libraryRow({ quantity: 800, flow_unit: 'g' })], [overrideRow]]),
      {},
    )
    expect(r.impacts[0].impact_value).toBeCloseTo(1.6, 12)
    expect(r.flow_contributions[0].unit_conversion).toContain('kg')
  })

  it('a database without migrate-034 runs on the library alone', async () => {
    let i = 0
    const seq = [COMPONENT, [libraryRow()]]
    const conn = {
      query: vi.fn().mockImplementation(async () => {
        if (i >= seq.length) throw Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' })
        return [seq[i++], null]
      }),
    } as any
    const r = await calculateComponentImpacts(1, conn, {})
    expect(r.impacts[0].impact_value).toBeCloseTo(1.52, 12)
  })

  it('the statement names hand-entered factors and keeps them out of the region lines', () => {
    const contribution = (over: Record<string, unknown>) => ({
      flow_id: 1, substance_id: 1, substance_name: 'Steel', cas_number: null, flow_type: 'input' as const,
      quantity: 0.8, unit: 'kg', characterization_factor: 2, impact_contribution: 1.6, category_id: 1,
      category_name: 'Global Warming', geographic_scope: 'US', factor_source: 'x', ...over,
    })
    const dq = summarizeDataQuality(
      [{
        component_id: 1, component_name: '10. Cut blank', component_type: 'operation', hierarchy_level: 4, impacts: [],
        flow_contributions: [
          contribution({ geographic_scope: 'Entered by hand', factor_origin: 'hand', factor_source: 'Entered by hand: EPD' }),
          contribution({ flow_id: 2, substance_name: 'Electricity', geographic_scope: 'US', factor_source: 'EPA eGRID 2023' }),
        ],
        total_flows_processed: 2, driver_flows_count: 2, warnings: [],
      }],
      { region: 'US' },
    )
    expect(dq.hand_entered).toBe(1)
    expect(dq.by_tier.unverified).toBe(1)
    const text = dq.statement.join(' ')
    expect(text).toContain('1 factor was entered by hand, not taken from the library: Steel (Global Warming).')
    expect(text).toContain('Every contribution uses a US factor.')
  })
})
