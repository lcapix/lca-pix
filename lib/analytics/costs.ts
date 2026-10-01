// Cost side of analytics: summing component cost columns into a per-case
// CostBreakdown, the cost chart/table rows, and money formatting.

import { EMPTY_COSTS } from './constants'
import type { AssessmentData, CostBreakdown } from './types'

/** Component rows of a GET /api/cases/:caseId/components response (`components`, else `data`, else none). */
export function costRowsFromResponse(compData: any): any[] {
  return compData?.components ?? compData?.data ?? []
}

/**
 * Adds every component row's cost columns into `into` and sets its total.
 *
 * Each column reads the snake_case DB column, else the camelCase field, else 0;
 * a value that is not a number reads as 0. A row with a currency overrides the
 * currency, so the last such row wins. The total is the activity-based (ABC)
 * sum when it is positive, else opex + capex.
 *
 * `into` is mutated and returned: a row that throws part-way (e.g. a null row)
 * leaves the earlier rows summed and the total untouched, as the page's inline
 * loop always did.
 */
export function sumComponentCosts(
  rows: any[],
  into: CostBreakdown = { ...EMPTY_COSTS },
): CostBreakdown {
  const costs = into
  for (const r of rows) {
    const labor = Number(r.labor_cost ?? r.laborCost ?? 0) || 0
    const energy = Number(r.energy_cost ?? r.energyCost ?? 0) || 0
    const material = Number(r.material_cost ?? r.materialCost ?? 0) || 0
    const transport =
      Number(r.transportation_cost ?? r.transportationCost ?? 0) || 0
    const equipment = Number(r.equipment_cost ?? r.equipmentCost ?? 0) || 0
    const overhead = Number(r.overhead_cost ?? r.overheadCost ?? 0) || 0
    const opex = Number(r.opex ?? r.operationalCostUSD ?? 0) || 0
    const capex = Number(r.capex ?? r.capitalCostUSD ?? 0) || 0
    costs.labor += labor
    costs.energy += energy
    costs.material += material
    costs.transport += transport
    costs.equipment += equipment
    costs.overhead += overhead
    costs.opex += opex
    costs.capex += capex
    if (r.currency) costs.currency = r.currency
  }
  // Prefer the detailed ABC breakdown total; fall back to opex+capex.
  const abcTotal =
    costs.labor + costs.energy + costs.material + costs.transport +
    costs.equipment + costs.overhead
  costs.total = abcTotal > 0 ? abcTotal : costs.opex + costs.capex
  return costs
}

/**
 * Money in `currency` for the user's locale: no decimals from 1000 up, at most
 * two below. An unknown currency code falls back to a "$" prefix.
 */
export function fmtMoney(v: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: v >= 1000 ? 0 : 2,
    }).format(v)
  } catch {
    return `$${v.toLocaleString()}`
  }
}

/** Currency the cost panel shows: the first case's, else USD. */
export function costPanelCurrency(assessmentData: AssessmentData[]): string {
  return assessmentData[0]?.costs.currency || 'USD'
}

/** True when at least one case has a positive total cost. */
export function hasAnyCost(assessmentData: AssessmentData[]): boolean {
  return assessmentData.some((d) => d.costs.total > 0)
}

/** One row of the stacked cost-breakdown chart: a scenario and its cost per type. */
export interface CostBreakdownRow {
  scenario: string
  Labor: number
  Energy: number
  Material: number
  Transport: number
  Equipment: number
  Overhead: number
}

/** Stacked cost-breakdown rows: one bar per scenario, segmented by cost type. */
export function buildCostBreakdownRows(
  assessmentData: AssessmentData[],
): CostBreakdownRow[] {
  return assessmentData.map((d) => ({
    scenario: d.caseName,
    Labor: d.costs.labor,
    Energy: d.costs.energy,
    Material: d.costs.material,
    Transport: d.costs.transport,
    Equipment: d.costs.equipment,
    Overhead: d.costs.overhead,
  }))
}

/** One row of the cost-vs-impact table. */
export interface CostVsImpactRow {
  scenario: string
  cost: number
  impact: number
  intensity: number
}

/**
 * Cost-vs-impact rows: each scenario's total cost with its total impact, so the
 * trade-off LCAPIX exists to surface is visible. `intensity` is cost per unit
 * of impact, 0 unless the impact is positive.
 */
export function buildCostVsImpactRows(
  assessmentData: AssessmentData[],
): CostVsImpactRow[] {
  return assessmentData.map((d) => ({
    scenario: d.caseName,
    cost: d.costs.total,
    impact: d.totalScore,
    // $ per unit of environmental load — lower is more cost-efficient.
    intensity: d.totalScore > 0 ? d.costs.total / d.totalScore : 0,
  }))
}
