import { describe, it, expect } from 'vitest'
import { isTransportSubstance, legNumber, legPayload, legState, tkmOf } from '@/lib/case-editor/transport-leg'
import {
  matchSubstances,
  substanceOptionLabel,
  suggestFlowsFor,
  swapOptionsFor,
  versionsOf,
} from '@/lib/case-editor/substance-search'

describe('transport legs (TKM-1 / TKM-2 / TKM-4)', () => {
  it('spots a transport substance by unit or name', () => {
    expect(isTransportSubstance({ unit: 'TKM', substance_name: 'Truck' })).toBe(true)
    expect(isTransportSubstance({ unit: 'kg', substance_name: 'Freight, rail' })).toBe(true)
    expect(isTransportSubstance({ unit: 'kg', substance_name: 'Steel' })).toBe(false)
    expect(isTransportSubstance(undefined)).toBe(false)
  })
  it('works out tonne-km only from two numbers above 0, without float noise', () => {
    expect(tkmOf('0.85', '450')).toBe(382.5)
    expect(tkmOf('0.1', '3')).toBe(0.3)
    expect(tkmOf('2', '')).toBeNull()
    expect(tkmOf('0', '100')).toBeNull()
    expect(tkmOf('2', '-5')).toBeNull()
    expect(legNumber(' ')).toBeNull()
    expect(legNumber('abc')).toBeNull()
  })
  it('a typed but unusable number blocks the leg; nothing typed is not in use', () => {
    expect(legState(true, '', '')).toEqual({ legTkm: null, legInUse: false, legInvalid: false })
    expect(legState(true, '2', '')).toEqual({ legTkm: null, legInUse: true, legInvalid: false })
    expect(legState(true, '2', '-5')).toMatchObject({ legInUse: true, legInvalid: true })
    expect(legState(false, '2', '-5')).toMatchObject({ legInUse: false, legInvalid: false })
    expect(legState(true, '2', '100').legTkm).toBe(200)
  })
  it('stores the leg as kg and km', () => {
    expect(legPayload('0.85', '450')).toEqual({ transport_mass_kg: 850, transport_distance_km: 450 })
  })
})

const sub = (id: number, name: string, over: Record<string, unknown> = {}) => ({ substance_id: id, substance_name: name, ...over }) as any
const CATALOG = [
  sub(1, 'Aluminium', { unit: 'kg', category: 'material', factor_count: 2 }),
  sub(2, 'Aluminium', { unit: 'kg', category: 'material', factor_count: 1, variant_of: 1, variant_label: 'recycled' }),
  sub(3, 'Steel', { unit: 'kg', category: 'material', factor_count: 1 }),
  sub(4, 'Electricity', { unit: 'kWh', category: 'energy', factor_count: 3 }),
  sub(5, 'Natural gas', { unit: 'm³', category: 'energy', factor_count: 1 }),
  sub(6, 'Carbon dioxide', { unit: 'kg', category: 'emission', factor_count: 1 }),
  sub(7, 'Cork', { unit: 'kg', category: 'material', factor_count: 0 }),
  sub(8, 'Copper', { unit: 'g', category: 'material', factor_count: 1 }),
]

describe('substance search', () => {
  it('lists versions right under their material', () => {
    expect(matchSubstances('alu', CATALOG).map((s) => s.substance_id)).toEqual([1, 2])
    expect(matchSubstances('recycled', CATALOG)).toEqual([])
    expect(matchSubstances('', CATALOG)).toHaveLength(8)
  })
  it('caps the list at 10', () => {
    const many = Array.from({ length: 15 }, (_, i) => sub(100 + i, `Thing ${i}`))
    expect(matchSubstances('thing', many)).toHaveLength(10)
  })
  it('names the other versions of the selected substance', () => {
    expect(versionsOf(CATALOG, 1).map((s) => s.substance_id)).toEqual([2])
    expect(versionsOf(CATALOG, 2).map((s) => s.substance_id)).toEqual([1])
    expect(versionsOf(CATALOG, null)).toEqual([])
  })
  it('suggests the named material, energy carriers and CO2, minus what the step has', () => {
    const s = suggestFlowsFor({ substances: CATALOG, flows: [], componentName: 'Cut aluminium blank', componentType: 'Operation' })
    expect(s.map((x) => [x.label, x.dir, x.unit])).toEqual([
      ['Aluminium', 'input', 'kg'],
      ['Electricity', 'input', 'kWh'],
      ['Natural gas', 'input', 'm³'],
      ['Carbon Dioxide', 'output', 'kg'],
    ])
    const without = suggestFlowsFor({
      substances: CATALOG,
      flows: [{ flow_id: 1, substance_id: 4, flow_type: 'input', quantity: 1, unit: 'kWh' }],
      componentName: 'Packaging',
      componentType: 'Subprocess',
    })
    // A subprocess draws energy; electricity is already on the step.
    expect(without.map((x) => x.label)).toEqual(['Natural gas', 'Carbon Dioxide'])
  })
  it('offers swaps of the same kind, with convertible units and impact data, versions first', () => {
    const { options, variants, others } = swapOptionsFor(CATALOG, 1)
    expect(variants.map((s) => s.substance_id)).toEqual([1, 2])
    expect(others.map((s) => s.substance_id)).toEqual([3, 8])
    expect(options.some((s) => s.substance_id === 7)).toBe(false) // no factors
    expect(substanceOptionLabel(CATALOG[1])).toBe('Aluminium — recycled')
    expect(substanceOptionLabel(CATALOG[0])).toBe('Aluminium')
  })
})
