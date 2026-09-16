// Grounded cost suggestion — derive labor/energy/material/transport cost from a
// node's REAL flows, not from per-unit assumptions.
//
// The old suggestion panels assumed "2 kWh per unit", "0.5 h per unit", and
// "always price steel". This reads the actual flows already on the node:
//   - energy carrier flows  → quantity × the carrier's $/unit
//   - material input flows   → mass (kg) × the ACTUAL material's $/kg
//   - transport (tonne-km)   → tkm × the mode's $/tkm
// The reference rates supply the RATE only; the quantity is always real. Any
// flow we cannot price is surfaced in `notes` (never silently dropped), and
// labor is only costed from real hours — never assumed.

import {
  pickMaterialRate,
  pickFreightRate,
  energyLineRate,
  getLaborRate,
} from '@/lib/integrations/reference-rates'

export interface SuggestFlow {
  substance: string
  dir: 'IN' | 'OUT'
  amount: number
  unit: string
}

export interface CostSuggestion {
  labor?: number
  energy?: number
  material?: number
  transportation?: number
  /** One human-readable line per costed flow (rate × real quantity = $). */
  lines: string[]
  /** Flows we could not price — surfaced so nothing is silently lost. */
  notes: string[]
  /** True when at least one figure came from a real flow. */
  grounded: boolean
}

// Mass units → kilograms. Anything not here can't be priced by $/kg.
const MASS_TO_KG: Record<string, number> = {
  kg: 1,
  kilogram: 1,
  g: 0.001,
  gram: 0.001,
  mg: 1e-6,
  t: 1000,
  tonne: 1000,
  tonnes: 1000,
  mt: 1000,
  lb: 0.453592,
  lbs: 0.453592,
  oz: 0.0283495,
}

const round2 = (n: number) => Math.round(n * 100) / 100

function isTransport(unit: string): boolean {
  // Freight is quantified in tonne-km. Key on the UNIT, not the substance name,
  // so a material like "shipping crate" (kg) is never mispriced as freight.
  return (unit || '').toLowerCase().replace(/\s/g, '') === 'tkm'
}

/**
 * Suggest costs from a node's flows. `laborHours` is the ONLY way labor is
 * costed — we never assume an hours figure.
 */
export function suggestCostsFromFlows(
  flows: SuggestFlow[],
  opts: { nodeName?: string; nodeType?: string; laborHours?: number } = {},
): CostSuggestion {
  const lines: string[] = []
  const notes: string[] = []
  let energy = 0
  let material = 0
  let transportation = 0
  let energyHit = false
  let materialHit = false
  let transportHit = false

  for (const f of flows || []) {
    const sub = f?.substance || ''
    const amt = Number(f?.amount) || 0
    const unit = f?.unit || ''
    if (amt <= 0) continue

    // Transport legs (tonne-km).
    if (isTransport(unit)) {
      const fr = pickFreightRate(sub)
      const cost = amt * fr.rate
      transportation += cost
      transportHit = true
      lines.push(
        `Transport: ${amt.toLocaleString()} tkm · ${fr.label} $${fr.rate}/tkm = $${cost.toFixed(2)}`,
      )
      continue
    }

    // Energy carriers, priced in their own unit.
    const er = energyLineRate(sub, unit)
    if (er) {
      const cost = amt * er.rate
      energy += cost
      energyHit = true
      lines.push(`Energy: ${amt.toLocaleString()} ${unit} · ${er.label} = $${cost.toFixed(2)}`)
      continue
    }

    // Material inputs (mass only).
    if (f.dir === 'IN') {
      const kgPer = MASS_TO_KG[(unit || '').toLowerCase()]
      if (kgPer !== undefined) {
        const kg = amt * kgPer
        const mr = pickMaterialRate(sub)
        const cost = kg * mr.rate
        material += cost
        materialHit = true
        lines.push(
          `Material: ${round2(kg).toLocaleString()} kg · ${mr.label} $${mr.rate}/kg = $${cost.toFixed(2)}`,
        )
        continue
      }
      notes.push(`${sub} (${amt} ${unit}): no reference price for this unit — enter cost manually.`)
      continue
    }

    // Outputs (emissions) carry no cost; anything else is left for the user.
    if (f.dir !== 'OUT') {
      notes.push(`${sub} (${amt} ${unit}): not costed automatically.`)
    }
  }

  const out: CostSuggestion = {
    lines,
    notes,
    grounded: energyHit || materialHit || transportHit,
  }
  if (energyHit) out.energy = round2(energy)
  if (materialHit) out.material = round2(material)
  if (transportHit) out.transportation = round2(transportation)

  // Labor: only from REAL hours. Never assumed.
  if (opts.laborHours && opts.laborHours > 0) {
    const lr = getLaborRate(opts.nodeName || opts.nodeType)
    const cost = round2(lr.rate * opts.laborHours)
    out.labor = cost
    lines.push(
      `Labor: ${opts.laborHours} h · ${lr.label} $${lr.rate}/h = $${cost.toFixed(2)}`,
    )
  } else {
    notes.push('Labor: set labor hours on the operation to cost it (not assumed).')
  }

  return out
}
