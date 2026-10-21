// Re-importing a document onto a case: a step that already has a cost in a
// column the document writes. Appending used to add into that column every
// time, so a routing imported twice doubled its labour without anyone seeing
// it. The review now lists each such step with what is there and what the
// document brings, and the reviewer keeps, replaces or adds (keep by default).
// Pure.

import type { IngestPlan } from '@/lib/ingest/maplca'
import { costColumn, type CostMode } from '@/lib/ingest/cost-columns'
import type { TargetComponent } from '@/lib/import/placement-suggestions'
import { costKey } from '@/lib/import/review'

/** One step and cost column that the document would write over an existing value. */
export interface CostConflict {
  /** "<component_id>|<column>": what the apply body's cost_modes is keyed by. */
  key: string
  stepName: string
  /** The column in plain words: "labor", "material", ... */
  label: string
  existing: number
  /** The sum of this document's lines for the step and column. */
  incoming: number
}

const COLUMN_LABEL: Record<string, string> = {
  labor_cost: 'labor',
  energy_cost: 'energy',
  material_cost: 'material',
  transportation_cost: 'transportation',
  opex: 'opex',
  capex: 'capex',
}

/**
 * The steps whose cost the document would change. A line's step is resolved
 * the way apply resolves it: its own placement, else a step of the case with
 * the line's (edited) step name, else the default step. A line going to a step
 * the document creates (newStep) has nothing to collide with.
 */
export function costConflicts(args: {
  plan: IngestPlan
  placement: Record<string, number | null>
  newStep: Record<string, string>
  attachComponentId: number | null
  components: TargetComponent[]
  finalName?: (name: string) => string
}): CostConflict[] {
  const { plan, placement, newStep, attachComponentId, components, finalName = (n) => n } = args
  const byId = new Map(components.map((c) => [c.component_id, c]))
  const byName = new Map(components.map((c) => [c.name.trim().toLowerCase(), c.component_id]))
  const incoming = new Map<string, number>()
  plan.costs.forEach((c, i) => {
    const key = costKey(c, i)
    const col = costColumn(c.category)
    if (!col || newStep[key]) return
    const target =
      placement[key] ?? (c.node ? byName.get(finalName(c.node).trim().toLowerCase()) : undefined) ?? attachComponentId
    if (target == null) return
    const k = `${target}|${col}`
    incoming.set(k, (incoming.get(k) ?? 0) + (Number(c.amount) || 0))
  })
  const out: CostConflict[] = []
  for (const [key, amount] of incoming) {
    const [id, col] = key.split('|')
    const step = byId.get(Number(id))
    const existing = step?.costs?.[col] ?? 0
    if (!step || existing === 0) continue
    out.push({ key, stepName: step.name, label: COLUMN_LABEL[col] ?? col, existing, incoming: amount })
  }
  return out
}

/** The step's value after apply under a decision. */
export function costAfter(c: CostConflict, mode: CostMode): number {
  return mode === 'keep' ? c.existing : mode === 'replace' ? c.incoming : c.existing + c.incoming
}
