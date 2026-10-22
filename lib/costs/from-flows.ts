// lib/costs/from-flows.ts
// What a step's material and energy cost would be from its flows: the number
// the step panel and the Cost view offer next to the cost that is stored, with
// one click to use it (E14). Pure: the costs route reads the flows and writes.
//
// Material: each input that is not an energy carrier, in kg, times the
// reference price that matches its name. No generic price is guessed: a
// material with no matching price, or an amount that is not a mass, is left
// out and named, so the person adds that cost by hand.
// Energy: each energy input priced in its own unit at the same reference the
// Cost view's lookup uses (energyReferencePrice: industrial electricity); one
// no price applies to is named the same way.
// Outputs (scrap, emissions) are not costs.

import { convertQuantity } from '@/lib/units'
import { MATERIAL_RATES, REFERENCE_VINTAGE, classifyEnergyCarrier, energyReferencePrice } from '@/lib/integrations/reference-rates'
import { costAmount, type CostLine } from './cost-basis'

export interface FlowForCost {
  substance: string
  direction: 'input' | 'output'
  quantity: number | null
  unit: string
}

export interface FlowCostSuggestion {
  kind: 'material' | 'energy'
  /** The amount from the priced flows; null when none could be priced. */
  amount: number | null
  lines: CostLine[]
  /** "Argon", "Packaging tape (in roll)": flows left out, for the person to cost by hand. */
  noPrice: string[]
}

/** rate_code on a cost built this way, so the Cost view can say where it came from. */
export const FROM_FLOWS = 'flows'

const sumLines = (lines: CostLine[]) => (lines.length ? costAmount(1, lines.reduce((t, l) => t + costAmount(l.quantity, l.rate), 0)) : null)

export function materialFromFlows(flows: FlowForCost[]): FlowCostSuggestion {
  const lines: CostLine[] = []
  const noPrice: string[] = []
  for (const f of flows) {
    if (f.direction !== 'input' || classifyEnergyCarrier(f.substance)) continue
    if (f.quantity === null || !Number.isFinite(f.quantity)) continue // "needs an amount" says it already
    const price = MATERIAL_RATES.find((m) => m.match.test(f.substance))
    if (!price) {
      noPrice.push(f.substance)
      continue
    }
    const kg = convertQuantity(f.quantity, f.unit, 'kg')
    if (!kg) {
      noPrice.push(`${f.substance} (in ${f.unit})`)
      continue
    }
    lines.push({
      label: f.substance,
      quantity: kg.quantity,
      unit: 'kg',
      rate: price.rate,
      rate_unit: '$/kg',
      source_kind: 'reference',
      source_name: price.label,
      vintage: REFERENCE_VINTAGE,
    })
  }
  return { kind: 'material', amount: sumLines(lines), lines, noPrice: [...new Set(noPrice)] }
}

export function energyFromFlows(flows: FlowForCost[]): FlowCostSuggestion {
  const lines: CostLine[] = []
  const noPrice: string[] = []
  for (const f of flows) {
    if (f.direction !== 'input' || !classifyEnergyCarrier(f.substance)) continue
    if (f.quantity === null || !Number.isFinite(f.quantity)) continue
    const price = energyReferencePrice(f.substance, f.unit)
    if (!price) {
      noPrice.push(`${f.substance} (in ${f.unit})`)
      continue
    }
    lines.push({
      label: f.substance,
      quantity: f.quantity,
      unit: f.unit,
      rate: price.rate,
      rate_unit: `$/${f.unit}`,
      source_kind: 'reference',
      source_name: price.label,
      vintage: REFERENCE_VINTAGE,
    })
  }
  return { kind: 'energy', amount: sumLines(lines), lines, noPrice: [...new Set(noPrice)] }
}

/** Both suggestions for a step's flows. */
export function costsFromFlows(flows: FlowForCost[]): { material: FlowCostSuggestion; energy: FlowCostSuggestion } {
  return { material: materialFromFlows(flows), energy: energyFromFlows(flows) }
}

/**
 * True when the flows' number is worth offering over the stored cost: they
 * differ by half a cent or more (the column keeps cents), or nothing is
 * stored and the flows come to at least half a cent.
 */
export function differsFromStored(stored: number | null, suggested: number | null): boolean {
  if (suggested === null) return false
  if (stored === null) return Math.round(suggested * 100) !== 0
  return Math.abs(stored - suggested) >= 0.005
}
