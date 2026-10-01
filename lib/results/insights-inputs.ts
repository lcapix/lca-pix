// The case's cost and the inputs the results page hands to Magic Insights,
// built from the displayed run and the case's own component cost columns.

import type { AssessmentResult } from './assessment'

/** A cost column as a number; missing or non-numeric is 0. */
export const numCost = (v: any): number => Number(v ?? 0) || 0

/**
 * The case's cost: every component cost column summed (what the case page's
 * Cost summary shows). A run carries no cost fields, so its `costs` are zero.
 */
export function realCaseCost(components: any[]): number {
  return components.reduce(
    (s: number, c: any) =>
      s +
      numCost(c.laborCost) +
      numCost(c.energyCost) +
      numCost(c.materialCost) +
      numCost(c.overheadCost) +
      numCost(c.equipmentCost) +
      numCost(c.transportationCost) +
      numCost(c.operationalCostUSD) +
      numCost(c.capitalCostUSD),
    0,
  )
}

/** Magic Insights' per-step breakdown of a run. */
export function insightsBreakdownOf(run: AssessmentResult | null | undefined) {
  return run?.componentBreakdown?.map((c) => ({
    component_id: c.component_id,
    component_name: c.component_name,
    impacts: c.impacts.map((i) => ({
      category_name: i.category_name,
      impact_value: i.impact_value,
      unit: i.unit,
    })),
  }))
}

/**
 * Magic Insights' per-flow impacts, so the insight can name the lever by
 * material (aluminum across six steps), not only by the step that books it.
 */
export function insightsMaterialsOf(run: AssessmentResult | null | undefined) {
  return (run?.flowDetail || []).map((f) => ({
    category_name: f.category_name,
    name: f.substance,
    value: Number(f.impact) || 0,
    step: f.component,
    tier: f.source_tier ?? null,
  }))
}

/**
 * Each step's own cost columns, so the trade-off view sets cost against
 * impact step by step instead of guessing.
 */
export function insightsStepCostsOf(components: any[] | undefined) {
  return (components || []).map((c: any) => ({
    id: String(c.id),
    name: c.name,
    labor: numCost(c.laborCost),
    material: numCost(c.materialCost),
    energy: numCost(c.energyCost),
    other:
      numCost(c.overheadCost) +
      numCost(c.equipmentCost) +
      numCost(c.transportationCost) +
      numCost(c.operationalCostUSD) +
      numCost(c.capitalCostUSD),
  }))
}
