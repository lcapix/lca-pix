// The reviewer's edits to the extracted step tree, and the attach / create /
// skip decision for each step when a document is appended to a live case.
// Edits are keyed by the step's ORIGINAL name, which is also how flows and
// costs refer to it, so a rename reaches every reference in one pass. Pure.

import type { IngestPlan } from '@/lib/ingest/maplca'
import type { Tier } from '@/lib/ingest/schema'
import { matchSteps } from '@/lib/ingest/step-match'
import type { TargetComponent } from '@/lib/import/placement-suggestions'

type PlanNode = IngestPlan['nodes'][number]

/** Edits to a planned step: its name, what tier it is called, where it sits, how many. */
export interface NodeEdit {
  name?: string
  tier?: string
  parent?: string | null
  quantity?: string
}

/** What happens to one of the document's steps when it is appended to a case. */
export interface StepAction {
  action: 'attach' | 'create' | 'skip'
  component_id: number | null
  /** Why: the match reason, or "chosen by you". Shown beside the picker. */
  reason: string
}

/**
 * The plan's steps with the reviewer's edits applied, plus the name map that
 * carries a rename to the step's children, flows and costs. A blank rename
 * keeps the original name; a quantity that is not a number keeps the plan's.
 */
export function applyNodeEdits(
  nodes: PlanNode[],
  nodeEdits: Record<string, NodeEdit>,
): { nodes: PlanNode[]; finalName: (name: string | null | undefined) => string | null } {
  const renamed = new Map<string, string>()
  for (const n of nodes) {
    const to = (nodeEdits[n.name]?.name ?? n.name).trim()
    if (to && to !== n.name) renamed.set(n.name, to)
  }
  const finalName = (name: string | null | undefined) => (name == null ? null : renamed.get(name) ?? name)
  const edited = nodes.map((n) => {
    const ed = nodeEdits[n.name] ?? {}
    const qty = ed.quantity !== undefined && ed.quantity.trim() !== '' ? Number(ed.quantity) : n.quantity
    return {
      ...n,
      name: finalName(n.name) as string,
      tier: (ed.tier ?? n.tier) as Tier,
      parent: finalName(ed.parent !== undefined ? ed.parent : n.parent),
      quantity: Number.isFinite(qty as number) ? qty : n.quantity,
    }
  })
  return { nodes: edited, finalName }
}

/**
 * Why an edited tree cannot be applied, or null when it can: a step with no
 * name, two steps with the same name, or a step that ends up inside itself.
 */
export function nodeTreeError(nodes: PlanNode[]): string | null {
  const names = nodes.map((n) => n.name)
  if (names.some((n) => !n.trim())) return 'Every step needs a name.'
  const dupe = names.find((n, i) => names.indexOf(n) !== i)
  if (dupe) return `Two steps are both called "${dupe}". Names have to be unique in a case.`
  const parentOf = new Map(nodes.map((n) => [n.name, n.parent ?? null]))
  for (const n of nodes) {
    const seen = new Set<string>([n.name])
    let cur = parentOf.get(n.name) ?? null
    while (cur) {
      if (seen.has(cur)) return `"${n.name}" ends up inside itself. Check the parent you picked for it.`
      seen.add(cur)
      cur = parentOf.get(cur) ?? null
    }
  }
  return null
}

/**
 * The suggested decision for each of the document's steps against the case's
 * own: a match attaches (with its reason). A step with no match is created
 * only when the document's payload IS steps (a routing); a BOM's or an
 * equipment list's placeholder step is skipped, because its lines go on the
 * case's existing steps through the STEP column.
 */
export function suggestStepActions(
  nodes: PlanNode[],
  components: TargetComponent[],
  createUnmatched: boolean,
): Record<string, StepAction> {
  const matches = matchSteps(
    nodes.map((n) => ({ name: n.name, parent: n.parent })),
    components.map((c) => ({
      component_id: c.component_id,
      component_name: c.name,
      parent_component_id: c.parent_component_id ?? null,
    })),
  )
  const out: Record<string, StepAction> = {}
  for (const m of matches) {
    out[m.node] =
      m.suggested === 'attach'
        ? { action: 'attach', component_id: m.component_id, reason: `${m.reason}: ${m.component_name}` }
        : createUnmatched
          ? { action: 'create', component_id: null, reason: 'not in this case yet' }
          : { action: 'skip', component_id: null, reason: 'not in this case; its lines go on the steps you pick below' }
  }
  return out
}

/**
 * node_actions for the apply body, keyed by each step's FINAL name (what the
 * server sees), from decisions keyed by the original name. A step with no
 * decision is skipped: nothing is created without one.
 */
export function buildNodeActions(
  editedNodes: PlanNode[],
  planNodes: PlanNode[],
  stepActions: Record<string, StepAction>,
): Record<string, { action: StepAction['action']; component_id: number | null }> {
  return Object.fromEntries(
    editedNodes.map((n, i) => {
      const d = stepActions[planNodes[i].name] ?? { action: 'skip' as const, component_id: null }
      return [n.name, { action: d.action, component_id: d.component_id }]
    }),
  )
}

/** The step-action picker's value for a decision: "create", "skip" or "attach:<id>". */
export function stepActionValue(a: StepAction | undefined): string {
  return a?.action === 'attach' ? `attach:${a.component_id}` : a?.action ?? 'skip'
}

/** The decision a picker value stands for, recorded as the reviewer's own. */
export function parseStepActionValue(v: string): StepAction {
  return v.startsWith('attach:')
    ? { action: 'attach', component_id: Number(v.split(':')[1]), reason: 'chosen by you' }
    : { action: v === 'create' ? 'create' : 'skip', component_id: null, reason: 'chosen by you' }
}
