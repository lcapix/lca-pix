/**
 * A case's inventory as the workspace shows it (E03, E04, E05): every flow with
 * its status, and, for a counted one, `amount × factor = impact` for climate,
 * read from the engine's own contribution (so a row always equals what a run
 * would count). Pure: the route feeds it the case's flows and an engine pass.
 */

import { convertQuantity } from '@/lib/units'
import type { FlowStatus, SourceKind } from '@/lib/ui/words'
import type { FlowContribution, LCAResult } from '@/lib/lca-engine'

/** The headline category: global warming, under any method's name for it. */
export const isClimate = (categoryName: string | null | undefined) => /global warming|climate/i.test(categoryName ?? '')

export interface CaseFlowRow {
  flow_id: number
  component_id: number
  substance_id: number
  substance_name: string
  substance_unit: string | null
  flow_type: 'input' | 'output'
  quantity: number | null
  unit: string
  driver_description?: string | null
}

export interface InventoryRow {
  flow_id: number
  component_id: number
  substance_id: number
  substance: string
  direction: 'input' | 'output'
  amount: number | null
  unit: string
  /** The substance's own unit (what "Pick kg or g" offers). */
  substance_unit: string | null
  note: string | null
  status: FlowStatus
  /** The climate arithmetic, when the flow is counted for climate. */
  climate: {
    /** The climate category's id (an own factor is set against it). */
    category_id: number
    factor: number
    /** The result unit, e.g. "kg CO2 eq". */
    unit: string
    impact: number
    /** "1 g = 0.001 kg" when the amount was converted. */
    conversion: string | null
    scope: string | null
    source: string | null
    tag: SourceKind
  } | null
}

/**
 * The source tag of a factor (look.md section 7): a number entered by hand, a
 * supplier's declaration (EPD), a factor for the run's region, or the Global
 * average the region fell back to.
 */
export function sourceKindOf(c: { scope?: string | null; source?: string | null; origin?: string | null }): SourceKind {
  const scope = (c.scope ?? '').trim()
  if (c.origin === 'hand' || /^entered by hand/i.test(scope) || /^entered by hand/i.test(c.source ?? '')) return 'hand'
  if (/\bepd\b|environdec|iso 14025|en 15804|supplier/i.test(c.source ?? '')) return 'supplier'
  if (scope && scope.toLowerCase() !== 'global') return 'regional'
  return 'global'
}

/** A flow's status for the climate view (rules.md: the four phrases). */
export function flowStatus(f: {
  quantity: number | null
  unit: string
  substance_unit: string | null
  excluded: boolean
  climate: boolean
}): FlowStatus {
  if (f.quantity === null || f.quantity === undefined) return 'needs_amount'
  if (f.excluded) return 'left_out'
  if (f.substance_unit && !convertQuantity(1, f.unit, f.substance_unit)) return 'left_out'
  return f.climate ? 'counted' : 'no_factor'
}

/** The inventory rows from the case's flows and an engine pass over them. */
export function buildInventory(flows: CaseFlowRow[], result: Pick<LCAResult, 'component_results'>): InventoryRow[] {
  const climate = new Map<number, FlowContribution>()
  const excluded = new Set<number>()
  for (const r of result.component_results) {
    for (const id of r.excluded_flow_ids ?? []) excluded.add(Number(id))
    for (const c of r.flow_contributions) {
      if (isClimate(c.category_name) && !climate.has(c.flow_id)) climate.set(c.flow_id, c)
    }
  }
  return flows.map((f) => {
    const c = climate.get(f.flow_id)
    const unitOf = (u: string) => u.split('/')[0].trim() || 'kg CO2 eq'
    return {
      flow_id: f.flow_id,
      component_id: f.component_id,
      substance_id: f.substance_id,
      substance: f.substance_name,
      direction: f.flow_type,
      amount: f.quantity === null || f.quantity === undefined ? null : Number(f.quantity),
      unit: f.unit,
      substance_unit: f.substance_unit,
      note: f.driver_description ?? null,
      status: flowStatus({
        quantity: f.quantity === null || f.quantity === undefined ? null : Number(f.quantity),
        unit: f.unit,
        substance_unit: f.substance_unit,
        excluded: excluded.has(f.flow_id),
        climate: !!c,
      }),
      climate: c
        ? {
            category_id: c.category_id,
            factor: c.characterization_factor,
            unit: unitOf(climateUnitOf(result, c)),
            impact: c.impact_contribution,
            conversion: c.unit_conversion ?? null,
            scope: c.geographic_scope ?? null,
            source: c.factor_source ?? null,
            tag: sourceKindOf({ scope: c.geographic_scope, source: c.factor_source, origin: c.factor_origin }),
          }
        : null,
    }
  })
}

function climateUnitOf(result: Pick<LCAResult, 'component_results'>, c: FlowContribution): string {
  for (const r of result.component_results) {
    const hit = r.impacts.find((i) => i.category_id === c.category_id)
    if (hit?.unit) return hit.unit
  }
  return 'kg CO2 eq'
}

export const STATUS_ORDER: FlowStatus[] = ['needs_amount', 'left_out', 'counted', 'no_factor']

/** How many rows have each status (the Inventory tabs and the tree's warnings). */
export function statusCounts(rows: Array<{ status: FlowStatus }>): Record<FlowStatus | 'all', number> {
  const out = { all: rows.length, counted: 0, no_factor: 0, needs_amount: 0, left_out: 0 }
  for (const r of rows) out[r.status]++
  return out
}

/**
 * How many flows differ from what a run froze (the "Out of date" banner): a
 * flow added or removed, or one whose substance, direction, amount or unit
 * changed. Amounts compare to 1e-9 relative.
 */
export function changedFlowCount(
  frozen: Array<{ flow_id: number; substance: string; direction: string; amount: number | null; unit: string }> | null | undefined,
  now: Array<{ flow_id: number; substance: string; direction: string; amount: number | null; unit: string }>,
): number {
  if (!frozen) return 0
  const before = new Map(frozen.map((f) => [Number(f.flow_id), f]))
  const after = new Map(now.map((f) => [Number(f.flow_id), f]))
  const same = (a: number | null, b: number | null) =>
    a === null || b === null ? a === b : Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
  let changed = 0
  for (const [id, f] of after) {
    const b = before.get(id)
    if (!b) changed++
    else if (b.substance !== f.substance || b.direction !== f.direction || b.unit !== f.unit || !same(b.amount, f.amount)) changed++
  }
  for (const id of before.keys()) if (!after.has(id)) changed++
  return changed
}

/**
 * The machine calculator (E04): electricity = power (kW) × time (s) × load,
 * in kWh. 0.75 kW × 8 s × 80% = 0.0013 kWh. Null for a value that is not a
 * number of 0 or more, or a load above 100%.
 */
export function machineKwh(kw: number, seconds: number, loadPct: number): number | null {
  if (![kw, seconds, loadPct].every((v) => Number.isFinite(v) && v >= 0) || loadPct > 100) return null
  return (kw * seconds * (loadPct / 100)) / 3600
}

/** A flow the machine calculator can fill: energy measured in a unit kWh converts to. */
export function calculatorFits(row: Pick<InventoryRow, 'unit'>): boolean {
  return !!convertQuantity(1, 'kWh', row.unit)
}

/** "2 need an amount" / "1 needs an amount · 1 left out" (rules.md). */
export function inventoryBadge(counts: { needs_amount: number; left_out: number } | null | undefined): string | null {
  if (!counts) return null
  const parts: string[] = []
  if (counts.needs_amount) parts.push(`${counts.needs_amount} ${counts.needs_amount === 1 ? 'needs' : 'need'} an amount`)
  if (counts.left_out) parts.push(`${counts.left_out} left out`)
  return parts.length ? parts.join(' · ') : null
}
