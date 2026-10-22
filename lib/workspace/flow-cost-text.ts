/**
 * What the step panel and the Cost view say about a step's cost from its
 * flows (E14): "Material cost from these flows: $0.76 (now $0.50)" with Use
 * it, and "No price for Argon: add its cost". Pure, so the rules are tested
 * without a browser.
 *
 * When to offer the flows' number: the cost is empty, or it came from the
 * flows and they changed since, or it is a number with no rate behind it (by
 * hand, or from before costs kept a basis). An energy price someone looked up
 * (or the import priced live) is not second-guessed by the reference table;
 * its sheet still shows the flows' number.
 * When to name the unpriced flows: only while the cost is empty or from the
 * flows. A cost entered by hand is taken to include them.
 * Neither, when a step above or below already carries that kind of cost: the
 * tree sums each step's subtree, so costing the flows here too would count
 * them twice (the sample prices 10. Cut blank's steel on Shear blank).
 */

import { FROM_FLOWS, differsFromStored, type FlowCostSuggestion } from '@/lib/costs/from-flows'
import type { CostBasis, CostBasisKind } from '@/lib/costs/cost-basis'
import { money } from '@/lib/ui/format'
import { COST_KIND_LABEL } from './cost-text'

export type FlowCostKind = 'material' | 'energy'
export const FLOW_COST_KINDS: FlowCostKind[] = ['material', 'energy']

export interface FromFlows {
  material: FlowCostSuggestion
  energy: FlowCostSuggestion
}

export interface FlowCostNote {
  kind: FlowCostKind
  /** The flows' number to offer with Use it; null when there is none to offer. */
  offer: number | null
  /** The stored amount the offer would replace. */
  stored: number | null
  /** Flows left out for want of a price, to name. */
  noPrice: string[]
}

type Stored = { kind: CostBasisKind; amount: number | null; basis: Pick<CostBasis, 'rate_code' | 'source_kind'> | null }

export function flowCostNotes(
  costs: Stored[],
  fromFlows: FromFlows | null | undefined,
  /** The steps above and below that carry this kind already (costedInLine). */
  inLine: (kind: FlowCostKind) => string[] = () => [],
): FlowCostNote[] {
  if (!fromFlows) return []
  const notes: FlowCostNote[] = []
  for (const kind of FLOW_COST_KINDS) {
    if (inLine(kind).length) continue
    const s = fromFlows[kind]
    const c = costs.find((x) => x.kind === kind)
    const stored = c?.amount ?? null
    const fromFlowsNow = c?.basis?.rate_code === FROM_FLOWS
    const priced = !!c?.basis && !fromFlowsNow && c.basis.source_kind !== 'entered'
    const offer = !priced && differsFromStored(stored, s.amount) ? s.amount : null
    const noPrice = stored === null || fromFlowsNow ? s.noPrice : []
    if (offer !== null || noPrice.length) notes.push({ kind, offer, stored, noPrice })
  }
  return notes
}

/** "Material cost from these flows: $0.76", with "(now $0.50)" when one is stored. */
export function offerText(note: Pick<FlowCostNote, 'kind' | 'offer' | 'stored'>, currency = 'USD'): string {
  const now = note.stored === null ? '' : ` (now ${money(note.stored, currency)})`
  return `${COST_KIND_LABEL[note.kind]} cost from these flows: ${money(note.offer, currency)}${now}`
}

/** "No price for Argon: add its cost"; two or more read "Argon and Tape: add their cost". */
export function noPriceText(names: string[]): string {
  const list = names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `No price for ${list}: add ${names.length < 2 ? 'its' : 'their'} cost`
}

type LineStep = { id: number; parentId: number | null; name: string; costs: Partial<Record<CostBasisKind, number | null>> }

/**
 * The steps above and below this one (not beside it) that already carry a
 * cost of this kind, nearest first: costing the step's flows as well would
 * count that kind twice in their sums.
 */
export function costedInLine(stepId: number, steps: LineStep[], kind: CostBasisKind): string[] {
  const byId = new Map(steps.map((s) => [s.id, s]))
  const out: string[] = []
  const seen = new Set<number>([stepId])
  for (let p = byId.get(stepId)?.parentId ?? null; p !== null && !seen.has(p); p = byId.get(p)?.parentId ?? null) {
    seen.add(p)
    const s = byId.get(p)
    if (s && s.costs[kind] != null) out.push(s.name)
  }
  const children = new Map<number, LineStep[]>()
  for (const s of steps) if (s.parentId !== null) children.set(s.parentId, [...(children.get(s.parentId) ?? []), s])
  const queue = [...(children.get(stepId) ?? [])]
  while (queue.length) {
    const s = queue.shift()!
    if (seen.has(s.id)) continue
    seen.add(s.id)
    if (s.costs[kind] != null) out.push(s.name)
    queue.push(...(children.get(s.id) ?? []))
  }
  return out
}
