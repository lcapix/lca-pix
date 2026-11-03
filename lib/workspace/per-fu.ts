/**
 * A run read per functional unit (ISO 14044 reports per functional unit).
 * The engine adds up the inventory as entered, which is the data basis: an
 * import can record a plant's year (5,200 frames), so its total is for 5,200.
 * Every screen that reads a run shows the answer for one functional unit, so
 * the run is scaled once here by the frozen per_fu_scale (reference flow /
 * data basis): totals, step values, step costs, and each flow's amount and
 * impact together, so amount × factor = impact still holds on every row.
 * The Inventory reads the case, not a run, and keeps the documents' amounts.
 * Pure; a run already per unit (scale 1) comes back as it is.
 */

import type { WorkspaceRun } from './use-runs'

export interface DataBasis {
  /** reference_flow / modeled_output, the factor every number was multiplied by. */
  scale: number
  /** How many units the inventory covers (the data basis). */
  modeledOutput: number
  referenceFlow: number
  unit: string | null
}

export type PerUnitRun = WorkspaceRun & { dataBasis?: DataBasis }

const times = (v: number | null | undefined, s: number) => (v == null || !Number.isFinite(Number(v)) ? v ?? null : Number(v) * s)

export function perFunctionalUnit(run: WorkspaceRun): PerUnitRun {
  const s = Number(run.goalScope?.per_fu_scale)
  if (!Number.isFinite(s) || s <= 0 || s === 1) return run
  const gs = run.goalScope!
  return {
    ...run,
    impacts: Object.fromEntries(Object.entries(run.impacts ?? {}).map(([k, v]) => [k, { ...v, value: v.value * s }])),
    costs: run.costs && { operational: run.costs.operational * s, capital: run.costs.capital * s, total: run.costs.total * s },
    componentBreakdown: (run.componentBreakdown ?? []).map((c: any) => ({
      ...c,
      impacts: (c.impacts ?? []).map((i: any) => ({ ...i, impact_value: Number(i.impact_value) * s })),
    })),
    flowDetail: (run.flowDetail ?? []).map((f) => ({ ...f, amount: f.amount * s, impact: f.impact * s })),
    run_steps: run.run_steps?.map((st) => ({
      ...st,
      cost: times(st.cost, s) as number | null,
      kinds: st.kinds && (Object.fromEntries(Object.entries(st.kinds).map(([k, v]) => [k, times(v, s)])) as typeof st.kinds),
    })),
    dataBasis: { scale: s, modeledOutput: Number(gs.modeled_output), referenceFlow: Number(gs.reference_flow), unit: gs.reference_flow_unit ?? null },
  }
}

/** "The inventory covers 5,200 units …; every answer here is per 1 frame." Null when they are the same. */
export function dataBasisLine(basis: { modeledOutput: number; referenceFlow: number } | null | undefined, unit: string): string | null {
  if (!basis || !(basis.modeledOutput > 0) || basis.modeledOutput === basis.referenceFlow) return null
  const n = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 6 })
  return `The inventory covers ${n(basis.modeledOutput)} units, as the documents give it; every answer here is per ${n(basis.referenceFlow)} ${unit}.`
}
