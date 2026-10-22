// Re-importing a document onto a case: a step that already has a flow of the
// same substance in the same direction. Appending used to insert the
// document's flows every time, so a BOM imported twice doubled its materials,
// and the step's carbon with them (stage-0 gate E2b). The review lists each
// such step and substance with what is there and what the document brings;
// the reviewer keeps, replaces or adds (keep by default). Pure.

import type { IngestPlan } from '@/lib/ingest/maplca'
import type { TargetComponent } from '@/lib/import/placement-suggestions'
import { correctedQuantity, flowKey, type FlowEdit } from '@/lib/import/review'

/** A flow already on a step, as GET /api/components/:id/flows returns it. */
export interface ExistingFlow {
  substance_id: number
  substance_name?: string | null
  flow_type: string
  quantity: number | string
  unit: string
}

/** One step, substance and direction that the document would add to again. */
export interface FlowConflict {
  /** "<component_id>|<substance_id>|<input|output>": what the apply body's flow_modes is keyed by. */
  key: string
  stepName: string
  substanceName: string
  direction: string
  /** Quantities by unit, e.g. "2.2 kg" or "2.2 kg + 1 ea". */
  existing: string
  incoming: string
}

/** "2.2 kg + 1 ea": quantities summed per unit, in first-seen order. */
function byUnit(items: Array<{ quantity: number; unit: string }>): string {
  const sums = new Map<string, number>()
  for (const i of items) sums.set(i.unit, (sums.get(i.unit) ?? 0) + i.quantity)
  return [...sums].map(([u, q]) => `${Math.round(q * 1e6) / 1e6} ${u}`).join(' + ')
}

/**
 * The flows the document would add to a step that already has that substance
 * in that direction. Only lines that will be applied count (ticked, with a
 * substance); a line's step is resolved the way apply resolves it: its own
 * placement, else a step named like the line's (edited) step, else the
 * default step. A line going to a step the document creates (newStep) cannot
 * collide.
 */
export function flowConflicts(args: {
  plan: IngestPlan
  edits: Record<number, FlowEdit>
  placement: Record<string, number | null>
  newStep: Record<string, string>
  attachComponentId: number | null
  components: TargetComponent[]
  existingFlows: Record<number, ExistingFlow[]>
  finalName?: (name: string) => string
}): FlowConflict[] {
  const { plan, edits, placement, newStep, attachComponentId, components, existingFlows, finalName = (n) => n } = args
  const byId = new Map(components.map((c) => [c.component_id, c]))
  const byName = new Map(components.map((c) => [c.name.trim().toLowerCase(), c.component_id]))
  const incoming = new Map<string, { name: string; items: Array<{ quantity: number; unit: string }> }>()
  plan.flows.forEach((f, i) => {
    const e = edits[i]
    if (!e?.include || e.substance_id == null) return
    const key = flowKey(f, i)
    if (newStep[key]) return
    const target = placement[key] ?? byName.get(finalName(f.node).trim().toLowerCase()) ?? attachComponentId
    if (target == null) return
    const k = `${target}|${e.substance_id}|${f.direction}`
    const acc = incoming.get(k) ?? { name: e.substance_name ?? f.substance_text, items: [] }
    acc.items.push({ quantity: correctedQuantity(f, e) ?? Number(f.quantity), unit: e.unit?.trim() || f.unit })
    incoming.set(k, acc)
  })
  const out: FlowConflict[] = []
  for (const [key, doc] of incoming) {
    const [id, substanceId, direction] = key.split('|')
    const there = (existingFlows[Number(id)] ?? []).filter(
      (x) => Number(x.substance_id) === Number(substanceId) && x.flow_type === direction,
    )
    const step = byId.get(Number(id))
    if (!step || there.length === 0) continue
    out.push({
      key,
      stepName: step.name,
      substanceName: there[0].substance_name || doc.name,
      direction,
      existing: byUnit(there.map((x) => ({ quantity: Number(x.quantity), unit: x.unit }))),
      incoming: byUnit(doc.items),
    })
  }
  return out
}
