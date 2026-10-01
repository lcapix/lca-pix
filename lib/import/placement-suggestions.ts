// Step placement when a document is appended to an existing case: the target
// case's components as steps, a suggested step for every flow and cost line
// (with the reason shown under the STEP picker), and the reason recorded when
// the reviewer picks a step by hand. Pure.

import type { IngestPlan } from '@/lib/ingest/maplca'
import { placeableSteps, suggestPlacement, type PlaceableStep } from '@/lib/ingest/placement'
import { costKey, flowKey } from '@/lib/import/review'

/** One component of the target case, as the import page keeps it. */
export interface TargetComponent {
  component_id: number
  name: string
  tier: string
}

/** Why a line was put on its step, and how sure that is (0..1). */
export interface PlacementWhy {
  confidence: number
  reason: string
}

/** Target-case components normalised from a /api/cases/:id/components answer (components or data array). */
export function targetComponentsFrom(d: any): TargetComponent[] {
  return (d?.components ?? d?.data ?? []).map((c: any) => ({
    component_id: c.component_id ?? c.id,
    name: c.component_name ?? c.name,
    tier: c.component_type ?? c.tier ?? '',
  }))
}

/** The components as placement steps (id / name / tier). */
export function toSteps(components: TargetComponent[]): PlaceableStep[] {
  return components.map((c) => ({ id: c.component_id, name: c.name, tier: c.tier }))
}

/** The steps offered in the STEP and DEFAULT STEP pickers (operations and tasks first). */
export function stepOptions(components: TargetComponent[]): PlaceableStep[] {
  return placeableSteps(toSteps(components))
}

/**
 * Suggest a step for every line when appending (document op column > name
 * match > assembly for purchased parts > unplaced). The reviewer confirms.
 * A line the connector already joined to a step of this case keeps that step.
 * The first line with a given key wins (a flow and a cost from one row share it).
 */
export function suggestPlacements(
  plan: IngestPlan,
  components: TargetComponent[],
): { placement: Record<string, number | null>; why: Record<string, PlacementWhy> } {
  const steps = toSteps(components)
  const next: Record<string, number | null> = {}
  const why: Record<string, PlacementWhy> = {}
  const add = (
    key: string,
    line: { label?: string; material?: string; opHint?: string },
    preset?: number | null,
  ) => {
    if (key in next) return
    // The connector already joined this line to a step (an equipment list
    // matches machines to steps by work center).
    if (preset && steps.some((s) => s.id === preset)) {
      next[key] = preset
      why[key] = { confidence: 1, reason: 'same work center as the routing' }
      return
    }
    const s = suggestPlacement(line, steps)
    next[key] = s.stepId
    why[key] = { confidence: s.confidence, reason: s.reason }
  }
  plan.flows.forEach((f, i) =>
    add(
      flowKey(f, i),
      { label: f.label, material: f.substance_text, opHint: f.op_hint },
      f.attach_component_id,
    ),
  )
  plan.costs.forEach((c, i) =>
    add(costKey(c, i), { label: c.label, opHint: c.op_hint }, c.attach_component_id),
  )
  return { placement: next, why }
}

/** The reason recorded when the reviewer changes a line's step (a truthy step id is their choice). */
export function stepChoiceReason(stepId: number | null, attachComponentId: number | null): string {
  return stepId ? 'chosen by you' : attachComponentId ? 'default step' : 'no step yet'
}
