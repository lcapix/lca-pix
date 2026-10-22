/**
 * A test fixture, not shipped: the painted steel bracket study (the education
 * version's sample), 17 steps in five tiers, nine flows, its costs, a base
 * case run and a what-if ("Shorter cure cycle") run. Pure data;
 * ./build-bracket.ts writes it. The API suites use it as a rich, fully
 * worked case whose numbers are known.
 *
 * Honesty rule (kept from the first worked example): the QUANTITIES and the
 * time drivers are illustrative and say so; every factor and every reference
 * rate they are multiplied by is the real library or the app's dated
 * reference table, so each number traces line by line. With the TRACI 2.1 /
 * US library the base case is 1.72 kg CO2-eq per bracket and the what-if
 * 1.667 (golden totals, checked by tests/api-real/flows/f33-case-inventory.test.ts).
 *
 * Differences from the design pack, on purpose:
 *   - The steel flow uses the library's "Steel" (worldsteel 2022 global
 *     average, 1.900), which the design calls "Steel, cold-rolled".
 *   - No cardboard flow: the library HAS a cardboard factor (US EPA WARM v16,
 *     0.937 kg CO2-eq/kg), so the design's "Cardboard: no factor" would be
 *     false, and with it the total would be 1.78, not 1.72. Logged for a
 *     decision (education-build-log, 2.9).
 */

import type { StageId } from '@/lib/life-cycle'
import { ENERGY_RATES, LABOR_RATES, MATERIAL_DEFAULT, MATERIAL_RATES, REFERENCE_VINTAGE } from '@/lib/integrations/reference-rates'
import type { CostBasisKind } from '@/lib/costs/cost-basis'

export const SAMPLE_PROJECT = {
  name: 'Painted steel bracket',
  description:
    'A finished study to read first. Quantities are illustrative; every factor and rate is real and named. Make your own copy to change it.',
  goal: "Find the largest contributor to the bracket's footprint, and test lower-energy curing.",
  functionalUnit: '1 painted steel bracket',
  boundary: 'cradle-to-gate' as const,
  boundaryNotes: 'Cradle to gate, plus packing.',
  method: 'TRACI 2.1',
  region: 'US',
}

export const SAMPLE_BASE_CASE = {
  name: 'Base case',
  description: 'The sample study. Read-only: make your own copy to change it.',
  referenceFlow: 1,
  referenceFlowUnit: 'bracket',
}

/** The what-if: one change, run again. */
export const SAMPLE_WHAT_IF = {
  name: 'Shorter cure cycle',
  description: 'The base case with one change: the cure oven runs a shorter cycle (0.40 to 0.25 kWh).',
  step: '30. Powder coat and cure',
  substance: 'Electricity',
  from: 0.4,
  to: 0.25,
}

export type Tier = 'product' | 'machine_line' | 'subprocess' | 'operation' | 'elemental_task'

export interface SampleFlow {
  substance: string
  direction: 'input' | 'output'
  /** null = no amount yet (not used by the sample: it is a finished study). */
  quantity: number
  unit: string
  note: string
}

/** One cost line: driver x a reference rate, or an amount entered for the sample. */
export type SampleCost =
  | {
      kind: CostBasisKind
      source: 'reference'
      driver: number
      driverUnit: string
      rate: number
      rateUnit: string
      rateLabel: string
      rateCode?: string
    }
  | { kind: CostBasisKind; source: 'entered'; amount: number; label: string }

export interface SampleStep {
  name: string
  tier: Tier
  /** Names from the product down to the parent. */
  parent: string | null
  stage?: StageId
  quantity?: number
  unit?: string
  description?: string
  flows?: SampleFlow[]
  costs?: SampleCost[]
}

const welder = LABOR_RATES.welder
const machinist = LABOR_RATES.machinist
const worker = LABOR_RATES.generic
const electricity = ENERGY_RATES.electricity_industrial
const steelPrice = MATERIAL_RATES.find((m) => m.label === 'Steel, hot-rolled')!
const resinPrice = MATERIAL_RATES.find((m) => m.label === 'Plastic resin (avg)')!

const labor = (hours: number, r: { rate: number; label: string; soc: string }): SampleCost => ({
  kind: 'labor',
  source: 'reference',
  driver: hours,
  driverUnit: 'h',
  rate: r.rate,
  rateUnit: '$/h',
  rateLabel: r.label.replace(/\s*\([^)]*\)\s*$/, ''),
  rateCode: r.soc,
})
const energy = (kwh: number): SampleCost => ({
  kind: 'energy',
  source: 'reference',
  driver: kwh,
  driverUnit: 'kWh',
  rate: electricity.rate,
  rateUnit: '$/kWh',
  rateLabel: 'Electricity, industrial',
  rateCode: 'electricity',
})
const material = (kg: number, price: { rate: number; label: string }): SampleCost => ({
  kind: 'material',
  source: 'reference',
  driver: kg,
  driverUnit: 'kg',
  rate: price.rate,
  rateUnit: '$/kg',
  rateLabel: price.label,
})

/** The 17 steps, parents before children. */
export const SAMPLE_STEPS: SampleStep[] = [
  { name: 'Painted steel bracket', tier: 'product', parent: null, quantity: 1, unit: 'bracket', description: 'The finished part this study is about.' },

  { name: 'Fabrication line', tier: 'machine_line', parent: 'Painted steel bracket', description: 'Shears, welder' },
  { name: 'Coating line', tier: 'machine_line', parent: 'Painted steel bracket', description: 'Shared line' },
  { name: 'Dispatch', tier: 'machine_line', parent: 'Painted steel bracket', description: 'Packing bench' },

  { name: 'Cutting', tier: 'subprocess', parent: 'Fabrication line' },
  { name: 'Welding', tier: 'subprocess', parent: 'Fabrication line' },
  { name: 'Powder coating', tier: 'subprocess', parent: 'Coating line' },
  { name: 'Packing', tier: 'subprocess', parent: 'Dispatch' },

  {
    name: '10. Cut blank',
    tier: 'operation',
    parent: 'Cutting',
    stage: 'materials',
    description: 'A 2 mm sheet is cut to one blank.',
    flows: [
      { substance: 'Steel', direction: 'input', quantity: 0.8, unit: 'kg', note: 'Illustrative: the blank weight. Weigh your own part and replace it.' },
      { substance: 'Electricity', direction: 'input', quantity: 0.05, unit: 'kWh', note: 'Illustrative: shear power x cutting time.' },
    ],
  },
  {
    name: '20. Weld tab',
    tier: 'operation',
    parent: 'Welding',
    stage: 'production',
    flows: [
      { substance: 'Electricity', direction: 'input', quantity: 0.12, unit: 'kWh', note: 'Illustrative: welder power x arc-on time.' },
      { substance: 'Argon', direction: 'input', quantity: 0.02, unit: 'kg', note: 'Illustrative: shielding gas per weld.' },
    ],
    costs: [
      labor(0.015, welder),
      energy(0.12),
      material(0.02, MATERIAL_DEFAULT),
      { kind: 'overhead', source: 'entered', amount: 0.12, label: 'Shop overhead, a sample figure' },
    ],
  },
  {
    name: '30. Powder coat and cure',
    tier: 'operation',
    parent: 'Powder coating',
    stage: 'production',
    flows: [
      { substance: 'Electricity', direction: 'input', quantity: 0.4, unit: 'kWh', note: 'Illustrative: oven kW x cure hours, divided by the parts in a batch.' },
      { substance: 'Powder coating', direction: 'input', quantity: 0.03, unit: 'kg', note: 'Illustrative: powder applied per bracket.' },
    ],
  },
  {
    name: '40. Pack and ship',
    tier: 'operation',
    parent: 'Packing',
    stage: 'distribution',
    flows: [
      { substance: 'Scrap steel', direction: 'output', quantity: 0.12, unit: 'kg', note: 'Illustrative: offcuts collected at dispatch.' },
    ],
  },

  {
    name: 'Shear blank',
    tier: 'elemental_task',
    parent: '10. Cut blank',
    stage: 'materials',
    quantity: 12,
    unit: 's',
    costs: [material(0.8, steelPrice), labor(0.0033, welder)],
  },
  {
    name: 'Deburr edges',
    tier: 'elemental_task',
    parent: '10. Cut blank',
    stage: 'materials',
    description: 'A 0.75 kW grinder for 8 seconds.',
    flows: [
      { substance: 'Electricity', direction: 'input', quantity: 0.0013, unit: 'kWh', note: 'Machine calculator: 0.75 kW x 8 s x 80% load = 0.0013 kWh.' },
    ],
    costs: [labor(0.0022, machinist)],
  },
  {
    name: 'Spray powder',
    tier: 'elemental_task',
    parent: '30. Powder coat and cure',
    stage: 'production',
    costs: [material(0.03, resinPrice), labor(0.0042, worker)],
  },
  {
    name: 'Cure 20 min',
    tier: 'elemental_task',
    parent: '30. Powder coat and cure',
    stage: 'production',
    quantity: 20,
    unit: 'min',
    description: '200 °C',
    costs: [energy(0.4), { kind: 'equipment', source: 'entered', amount: 0.05, label: 'Oven time, a sample figure' }],
  },
  {
    name: 'Fold and tape',
    tier: 'elemental_task',
    parent: '40. Pack and ship',
    stage: 'distribution',
    flows: [
      // A unit the tape's kg cannot take: the sample's one "Left out, unit can't
      // convert" line, the kind a document import produces (E04: "Pick kg or g").
      { substance: 'Packaging tape', direction: 'input', quantity: 1, unit: 'roll', note: 'Recorded as 1 roll. Pick kg or g to count it.' },
    ],
    costs: [labor(0.0042, worker)],
  },
]

export const SAMPLE_REFERENCE_VINTAGE = REFERENCE_VINTAGE

/** Cents, as the component cost columns store them. */
export const cents = (v: number) => Math.round(v * 100) / 100

/** The amount a cost line puts in its column. */
export function sampleCostAmount(c: SampleCost): number {
  return c.source === 'entered' ? cents(c.amount) : cents(c.driver * c.rate)
}

export const TIER_LEVEL: Record<Tier, number> = {
  product: 1,
  machine_line: 2,
  subprocess: 3,
  operation: 4,
  elemental_task: 5,
}
