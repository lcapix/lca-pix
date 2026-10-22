/**
 * A person's own factor for one flow (migrate-034, E03 "Use my own number").
 *
 * Pure rules shared by the route and the engine:
 *   - what a request may set (FactorOverrideInput),
 *   - which result unit a run's method reports a category in,
 *   - how an override takes the place of the library factor for that flow and
 *     category in a run (mergeFactorOverrides).
 *
 * An override is used only when its result unit is the unit the run's method
 * reports the category in. A number in kg PO4 eq is not added to a TRACI
 * eutrophication total in kg N eq: it is left out and the run says why.
 */

import { z } from 'zod'
import { splitFactorUnit } from '@/lib/units'

/** The words the run, the report and the source tag use for these factors. */
export const ENTERED_BY_HAND = 'Entered by hand'

export const FACTOR_OVERRIDE_LIMITS = {
  source: 255,
  note: 1000,
  unit: 50,
  /** Larger than any real characterization factor, small enough to sum safely. */
  maxAbs: 1e12,
} as const

const trimmed = (max: number) => z.string().trim().min(1).max(max)

/** Body of PUT /api/flows/[flowId]/factor. */
export const FactorOverrideInput = z
  .object({
    category_id: z.number().int().positive(),
    factor_value: z
      .number()
      .finite()
      .refine((v) => Math.abs(v) <= FACTOR_OVERRIDE_LIMITS.maxAbs, 'factor_value is out of range'),
    /** Defaults to the flow's own unit. */
    per_unit: trimmed(FACTOR_OVERRIDE_LIMITS.unit).optional(),
    source: trimmed(FACTOR_OVERRIDE_LIMITS.source),
    note: z.string().trim().max(FACTOR_OVERRIDE_LIMITS.note).nullable().optional(),
  })
  .strict()
export type FactorOverrideInput = z.infer<typeof FactorOverrideInput>

/**
 * One line naming a flow's own factors, for Compare ("Global Warming 0.5 kg
 * CO2 eq / kWh"). Null when the flow uses the library only. Stable order, so
 * two flows with the same numbers read the same.
 */
export function describeOwnFactors(
  rows: Array<{ category_name: string; factor_value: number | string; impact_unit: string; per_unit: string }>,
): string | null {
  if (!rows.length) return null
  return [...rows]
    .sort((a, b) => a.category_name.localeCompare(b.category_name))
    .map((r) => `${r.category_name} ${Number(Number(r.factor_value).toPrecision(6))} ${r.impact_unit} / ${r.per_unit}`)
    .join('; ')
}

/** One stored override, joined with its flow and category for the engine. */
export interface OverrideRow {
  flow_id: number
  category_id: number
  category_name: string
  category_unit: string
  factor_value: number | string
  impact_unit: string
  per_unit: string
  source: string
  note?: string | null
  /** The unit the run's method reports this category in (null: no library row). */
  method_unit?: string | null
  substance_id: number
  substance_name: string
  cas_number: string | null
  substance_default_unit: string | null
  flow_type: 'input' | 'output'
  quantity: unknown
  flow_unit: string | null
}

/** The fields of an engine factor row the merge reads and writes. */
export interface EngineFactorRow {
  flow_id: number
  category_id: number
  [key: string]: any
}

const unitKey = (u: string | null | undefined) => (u ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/** True when two result units name the same thing ('kg CO2 eq' = 'kg co2 eq'). */
export function sameImpactUnit(a: string | null | undefined, b: string | null | undefined): boolean {
  return unitKey(a) !== '' && unitKey(a) === unitKey(b)
}

/**
 * The result unit a method reports a category in, from the numerators of its
 * library factor labels ('kg N eq / kg' → 'kg N eq'). Null when the method has
 * no factor in the category, or its factors disagree (the data needs fixing).
 */
export function methodCategoryUnit(factorUnits: Array<string | null | undefined>): string | null {
  const seen = new Map<string, string>()
  for (const label of factorUnits) {
    const n = splitFactorUnit(label).numerator
    if (n) seen.set(unitKey(n), n)
  }
  return seen.size === 1 ? [...seen.values()][0] : null
}

/** The result unit a new override is stated in: the method's, else the category's. */
export function overrideImpactUnit(methodUnit: string | null | undefined, categoryUnit: string): string {
  return methodUnit?.trim() || categoryUnit
}

/**
 * Put each override in place of the library row for its flow and category,
 * or add it where the library has none (Argon). An override whose result unit
 * is not the method's unit for the category is left out, and the library row
 * (if any) stays; the warning says which.
 *
 * Override rows carry `factor_origin: 'hand'`, the source as
 * "Entered by hand: <source>" and a direction that matches the flow, so the
 * engine's direction rule keeps them.
 */
export function mergeFactorOverrides<R extends EngineFactorRow>(
  rows: R[],
  overrides: OverrideRow[],
): {
  rows: Array<R | (EngineFactorRow & Record<string, any>)>
  warnings: string[]
  refused: number
  /** Flows whose own factor was refused for its result unit. */
  refusedFlowIds: number[]
} {
  const warnings: string[] = []
  let refused = 0
  const refusedFlowIds: number[] = []
  const usable = new Map<string, OverrideRow>()
  for (const o of overrides) {
    const method = o.method_unit?.trim() || null
    if (method && !sameImpactUnit(o.impact_unit, method)) {
      refused++
      refusedFlowIds.push(Number(o.flow_id))
      warnings.push(
        `Flow ${o.flow_id} (${o.substance_name}): the number entered by hand for ${o.category_name} is in ${o.impact_unit}, but this method reports ${o.category_name} in ${method}. It is LEFT OUT of this run.`,
      )
      continue
    }
    usable.set(`${o.flow_id}:${o.category_id}`, o)
  }
  if (!usable.size) return { rows, warnings, refused, refusedFlowIds }

  const merged: Array<R | (EngineFactorRow & Record<string, any>)> = rows.filter(
    (r) => !usable.has(`${r.flow_id}:${r.category_id}`),
  )
  for (const o of usable.values()) {
    const note = o.note?.trim()
    merged.push({
      flow_id: Number(o.flow_id),
      substance_id: o.substance_id,
      substance_name: o.substance_name,
      cas_number: o.cas_number,
      substance_default_unit: o.substance_default_unit,
      flow_type: o.flow_type,
      quantity: o.quantity,
      flow_unit: o.flow_unit,
      category_id: Number(o.category_id),
      category_name: o.category_name,
      category_unit: o.category_unit,
      factor_unit: `${o.impact_unit} / ${o.per_unit}`,
      characterization_factor: o.factor_value,
      factor_basis: o.flow_type === 'output' ? 'elementary' : 'embodied',
      geographic_scope: ENTERED_BY_HAND,
      factor_source: `${ENTERED_BY_HAND}: ${o.source}${note ? ` (${note})` : ''}`,
      factor_origin: 'hand',
    })
  }
  return { rows: merged, warnings, refused, refusedFlowIds }
}
