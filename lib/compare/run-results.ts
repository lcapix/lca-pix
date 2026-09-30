// What Compare Cases reads from one run: its totals, its per-step results and
// the step costs, per functional unit. A frozen run (snapshot v3) answers from
// its snapshot only, so a step deleted or renamed after the run keeps its name
// and a cost edited after the run does not rewrite it. An older run falls back
// to its stored result rows, named from the live step table, and is labelled.
//
// Also: whether a case can be ranked at all (a case with no flows, no run, or
// a run that computed nothing never can), and whether a frozen run still
// describes the case (a delete leaves no updated_at behind, so compare ids).
//
// Pure module: no DB.

import {
  hasFrozenResults,
  LEGACY_RESULTS_SOURCE,
  perFunctionalUnitScale,
  ZERO_INVENTORY_WARNING,
  type RunSnapshot,
} from '@/lib/run-snapshot'
import type { CompareStatus } from './analytics'
import { COST_KEYS, type CostKey } from './diff'

export type { CompareStatus }

export interface RunTotal {
  category: string
  unit: string
  value: number
  /** Flows behind this total (frozen runs only). 0 means nothing was computed. */
  flowCount?: number
}

export interface LegacyRunRows {
  /** assessment_results summed per category. */
  totals: Array<{ category: string; unit: string; value: number }>
  /** assessment_results summed per step and category; null = the step was deleted (migrate-027). */
  byStep: Array<{ componentId: number | null; category: string; value: number }>
}

export interface CurrentStep {
  id: number
  name: string
  costs: Record<CostKey, number>
}

export interface RunResults {
  source: 'snapshot' | typeof LEGACY_RESULTS_SOURCE
  totals: RunTotal[]
  byStep: Array<{ step: string; category: string; value: number }>
  costs: Array<{ step: string } & Record<CostKey, number>>
  /** 'run': the costs frozen with the run; 'current': the case's costs now. */
  costsSource: 'run' | 'current'
  /** Distinct flows the run characterized; null when there is no way to tell. */
  characterizedFlows: number | null
  /** The run found no flow on any step. */
  zeroInventory: boolean
}

const hasCost = (row: Record<CostKey, number>) => COST_KEYS.some((k) => row[k] > 0)

export function runResults(args: {
  snapshot: RunSnapshot | null
  /** Case total × scale = result per functional unit. */
  scale: number
  /** Read only when the run has no frozen results. */
  legacy?: LegacyRunRows
  currentSteps: CurrentStep[]
}): RunResults {
  const { snapshot, scale, currentSteps } = args
  const detailFlows = snapshot ? new Set(snapshot.flow_detail.map((f) => f.flow_id)).size : null
  const zeroInventory =
    !!snapshot?.warnings?.includes(ZERO_INVENTORY_WARNING) ||
    (hasFrozenResults(snapshot) && Array.isArray(snapshot.inventory) && snapshot.inventory.length === 0)

  if (hasFrozenResults(snapshot)) {
    return {
      source: 'snapshot',
      totals: snapshot.totals.map((t) => ({
        category: t.category_name,
        unit: t.unit,
        value: t.value * scale,
        flowCount: t.flow_count,
      })),
      byStep: snapshot.steps.flatMap((s) =>
        s.impacts.map((i) => ({ step: s.name, category: i.category_name, value: i.value * scale })),
      ),
      costs: snapshot.steps
        .map((s) => ({
          step: s.name,
          ...(Object.fromEntries(COST_KEYS.map((k) => [k, (Number(s.costs?.[k]) || 0) * scale])) as Record<CostKey, number>),
        }))
        .filter(hasCost),
      costsSource: 'run',
      characterizedFlows: detailFlows,
      zeroInventory,
    }
  }

  const legacy = args.legacy ?? { totals: [], byStep: [] }
  const nameById = new Map(currentSteps.map((s) => [s.id, s.name]))
  return {
    source: LEGACY_RESULTS_SOURCE,
    totals: legacy.totals.map((t) => ({ category: t.category, unit: t.unit, value: t.value * scale })),
    byStep: legacy.byStep.map((r) => ({
      step:
        r.componentId === null || r.componentId === undefined
          ? 'Removed step'
          : (nameById.get(r.componentId) ?? `Removed step #${r.componentId}`),
      category: r.category,
      value: r.value * scale,
    })),
    costs: currentSteps
      .map((s) => ({
        step: s.name,
        ...(Object.fromEntries(COST_KEYS.map((k) => [k, (s.costs[k] || 0) * scale])) as Record<CostKey, number>),
      }))
      .filter(hasCost),
    costsSource: 'current',
    // A v1/v2 snapshot still lists the flows it characterized; without one,
    // stored result rows are the only evidence the run computed anything.
    characterizedFlows: detailFlows ?? (legacy.byStep.length || legacy.totals.length ? null : 0),
    zeroInventory,
  }
}

/**
 * Whether a case can be ranked. A case with no completed run, no flows now, or
 * a run that computed nothing is incomplete and is never ranked or called a
 * winner. A run older than the case's last edit is stale: re-run to compare.
 */
export function compareStatus(input: {
  hasRun: boolean
  currentFlows: number
  characterizedFlows: number | null
  zeroInventory: boolean
  editedSinceRun: boolean
}): { status: CompareStatus; reason: string | null } {
  if (input.currentFlows === 0) return { status: 'incomplete', reason: 'No flows yet' }
  if (!input.hasRun) return { status: 'incomplete', reason: 'Not run yet' }
  if (input.zeroInventory) return { status: 'incomplete', reason: 'Its run had no flows' }
  if (input.characterizedFlows === 0) {
    return { status: 'incomplete', reason: 'No flow in its run had an impact factor' }
  }
  if (input.editedSinceRun) return { status: 'stale', reason: 'Edited after this run' }
  return { status: 'ok', reason: null }
}

/**
 * True when the case no longer matches what a frozen run recorded: a step or
 * flow added or deleted, or the reference flow / data basis changed. False when
 * the run froze no results (nothing to compare against).
 */
export function snapshotDrift(
  snapshot: RunSnapshot | null,
  current: {
    componentIds: number[]
    flowIds: number[]
    referenceFlow?: number | string | null
    modeledOutput?: number | string | null
  },
): boolean {
  if (!hasFrozenResults(snapshot)) return false
  const sameSet = (a: number[], b: number[]) => {
    const x = new Set(a.map(Number))
    const y = new Set(b.map(Number))
    return x.size === y.size && [...x].every((v) => y.has(v))
  }
  if (!sameSet(snapshot.steps.map((s) => s.component_id), current.componentIds)) return true
  if (Array.isArray(snapshot.inventory) && !sameSet(snapshot.inventory.map((f) => f.flow_id), current.flowIds)) {
    return true
  }
  const gs = snapshot.goal_scope
  if (gs) {
    const was = perFunctionalUnitScale(gs.reference_flow, gs.modeled_output)
    const now = perFunctionalUnitScale(current.referenceFlow, current.modeledOutput)
    if (Math.abs(was - now) > 1e-12 * Math.max(1, Math.abs(was))) return true
  }
  return false
}
