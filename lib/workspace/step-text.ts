/**
 * What a step card and the step panel say (E03, E03c). Pure.
 *   Sub line, in order: "Needs an amount" when one of its flows has none; else
 *   its main flow ("Steel 0.80 kg"); else its description ("Shears, welder");
 *   else its own amount when it is not "1 unit" ("12 s"); else the tier word.
 */

import { amountBox } from '@/lib/ui/format'
import type { InventoryRow } from './inventory'
import { TIER_LABEL, type Tier } from './tier-layout'

export interface StepInfo {
  id: number
  name: string
  tier: Tier
  quantity?: number | string | null
  unit?: string | null
  description?: string | null
}

const TIER_WORD: Record<Tier, string> = {
  product: 'Product',
  machine_line: 'Machine / line',
  subprocess: 'Subprocess',
  operation: 'Operation',
  elemental_task: 'Task',
}

/**
 * A step's description as stored, split from the provenance an import appends
 * ("… [source: routing.csv · row 4]"): the text a person reads, and where the
 * step came from, shown apart and quietly. The stored value keeps both.
 */
export function splitSource(raw: string | null | undefined): { text: string | null; source: string | null } {
  const s = String(raw ?? '')
  const m = /\s*\[source:\s*([^\]]+)\]\s*$/.exec(s)
  const text = (m ? s.slice(0, m.index) : s).trim()
  return { text: text || null, source: m ? m[1].trim() : null }
}

/** The step's own flows that need an amount. */
export function stepNeedsAmount(stepId: number, rows: InventoryRow[]): boolean {
  return rows.some((r) => r.component_id === stepId && r.status === 'needs_amount')
}

/** The flow a card names: the one with the most climate impact, else the first. */
export function mainFlow(stepId: number, rows: InventoryRow[]): InventoryRow | null {
  const own = rows.filter((r) => r.component_id === stepId)
  if (!own.length) return null
  return [...own].sort((a, b) => (b.climate?.impact ?? -1) - (a.climate?.impact ?? -1))[0]
}

export function stepSubLine(step: StepInfo, rows: InventoryRow[]): { text: string; needs: boolean } {
  if (stepNeedsAmount(step.id, rows)) return { text: 'Needs an amount', needs: true }
  const f = mainFlow(step.id, rows)
  if (f) return { text: `${f.substance} ${amountBox(f.amount)} ${f.unit}`, needs: false }
  const d = (step.description ?? '').trim()
  if (d) return { text: d, needs: false }
  const q = Number(step.quantity)
  const unit = (step.unit ?? '').trim()
  if (step.tier === 'product') return { text: `Product · ${Number.isFinite(q) ? amountBox(q) : 1} ${unit || 'unit'}`, needs: false }
  if (Number.isFinite(q) && unit && !(q === 1 && /^units?$/i.test(unit))) return { text: `${amountBox(q)} ${unit}`, needs: false }
  return { text: TIER_WORD[step.tier], needs: false }
}

/** "Operation · under Welding". */
export function stepKicker(step: StepInfo, parentName: string | null): string {
  return parentName ? `${TIER_LABEL[step.tier]} · under ${parentName}` : TIER_LABEL[step.tier]
}

/** "2 flows in · no tasks below it", "1 flow in, 1 out · 2 tasks below it". */
export function stepCountsLine(stepId: number, rows: InventoryRow[], childCount: number, childTier: Tier | null): string {
  const own = rows.filter((r) => r.component_id === stepId)
  const ins = own.filter((r) => r.direction === 'input').length
  const outs = own.length - ins
  const flows =
    own.length === 0
      ? 'No flows'
      : [ins ? `${ins} ${ins === 1 ? 'flow' : 'flows'} in` : null, outs ? `${outs} out` : null].filter(Boolean).join(', ')
  const word = childTier === 'elemental_task' || childTier === null ? 'task' : 'step'
  const below = childCount === 0 ? `no ${word}s below it` : `${childCount} ${childCount === 1 ? word : `${word}s`} below it`
  return `${flows} · ${below}`
}
