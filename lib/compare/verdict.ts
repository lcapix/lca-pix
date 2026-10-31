/**
 * Compare's verdict and change by category (P51, P54): case B against case A,
 * in words and as one bar per impact category. Classic Analytics had both but
 * loaded one case, so they never showed; Compare loads the two.
 *
 * The numbers follow the Overview line's rule (whyNoNumber): when any check
 * is not ok (method, region, functional unit, a stale or missing run) or a run
 * is incomplete, there is no percentage and no cost difference, only why.
 * A category counts only when both runs computed it; one a side lacks is
 * named as not counted, never drawn as zero. Percent is (B − A) / |A|, so it
 * has no value when A is 0. Pure module: no DB.
 */

import { costView, rankValue, type CaseResult } from '@/lib/compare/analytics'
import { whyNoNumber, type CheckedCase } from '@/lib/project/comparison-banner'
import { fixed, money } from '@/lib/ui/format'

export type VerdictCase = CheckedCase & Pick<CaseResult, 'totals' | 'costs'>

export interface CaseVerdict {
  category: string
  /** The case that comes out ahead (lower in the category), or null. */
  ahead: string | null
  /** "My bracket is 12.3% lower in Global Warming than Painted steel bracket." */
  line: string | null
  /** (B − A) / |A| × 100, or null when there is no fair percentage. */
  pct: number | null
  /** "My bracket costs $0.12 less than Painted steel bracket, per functional unit." */
  cost: string | null
  costDelta: number | null
  /** Why there is no percentage (a failed check, a missing result, A at 0). */
  why: string | null
}

/** "12.3%": one decimal, as the hub and the Overview line show a share. */
const pctText = (pct: number) => `${fixed(Math.abs(pct), 1)}%`

/** B against A in the selected category, plus total cost when both have cost. */
export function caseVerdict(a: VerdictCase, b: VerdictCase, category: string): CaseVerdict {
  const none = { category, ahead: null, line: null, pct: null, cost: null, costDelta: null }
  const blocked = whyNoNumber(a, b)
  if (blocked) return { ...none, why: blocked }

  const ca = costView(a).total
  const cb = costView(b).total
  // Cost reads only when both cases carry step costs: a case with none is not free.
  const costDelta = ca > 0 && cb > 0 ? cb - ca : null
  const cost =
    costDelta === null
      ? null
      : Math.abs(costDelta) < 0.005
        ? `${b.name} costs the same as ${a.name}, per functional unit.`
        : `${b.name} costs ${money(Math.abs(costDelta))} ${costDelta < 0 ? 'less' : 'more'} than ${a.name}, per functional unit.`

  const va = rankValue(a, category)
  const vb = rankValue(b, category)
  const missing = va === null ? a : vb === null ? b : null
  if (missing) return { ...none, cost, costDelta, why: `${missing.name} has no result in ${category}, so there is no percentage.` }
  if (va === 0) return { ...none, cost, costDelta, why: `${a.name} is 0 in ${category}, so a percentage against it has no meaning.` }

  const pct = ((vb! - va!) / Math.abs(va!)) * 100
  // Shown at one decimal: a change that rounds to 0.0% reads as the same.
  if (fixed(pct, 1) === '0.0' || fixed(pct, 1) === '-0.0') {
    return { category, ahead: null, line: `${b.name} and ${a.name} are the same in ${category}, within 0.1%.`, pct, cost, costDelta, why: null }
  }
  const lower = pct < 0
  return {
    category,
    ahead: lower ? b.name : a.name,
    line: `${b.name} is ${pctText(pct)} ${lower ? 'lower' : 'higher'} in ${category} than ${a.name}.`,
    pct,
    cost,
    costDelta,
    why: null,
  }
}

export interface DeltaRow {
  category: string
  unit: string
  a: number
  b: number
  /** (B − A) / |A| × 100. */
  pct: number
}

export interface DeltaByCategory {
  /** One bar each: categories both runs computed, with A not 0. */
  rows: DeltaRow[]
  /** Both runs computed it, but A is 0: no percentage. */
  zeroBase: string[]
  /** One side has no result: not counted, never drawn as zero. */
  notCounted: Array<{ category: string; missingIn: string }>
  /** Why nothing is drawn (a failed check), or null. */
  why: string | null
  /** The chart in one sentence, for its accessible name. */
  summary: string
}

/** B against A in every category either run computed. */
export function deltaByCategory(a: VerdictCase, b: VerdictCase): DeltaByCategory {
  const blocked = whyNoNumber(a, b)
  if (blocked) {
    return { rows: [], zeroBase: [], notCounted: [], why: blocked, summary: `No change by category: ${blocked}` }
  }
  const categories: Array<{ category: string; unit: string }> = []
  for (const t of [...a.totals, ...b.totals]) {
    if (!categories.some((k) => k.category === t.category)) categories.push({ category: t.category, unit: t.unit })
  }
  const rows: DeltaRow[] = []
  const zeroBase: string[] = []
  const notCounted: DeltaByCategory['notCounted'] = []
  for (const { category, unit } of categories) {
    const va = rankValue(a, category)
    const vb = rankValue(b, category)
    if (va === null || vb === null) {
      notCounted.push({ category, missingIn: va === null && vb === null ? `${a.name} and ${b.name}` : va === null ? a.name : b.name })
    } else if (va === 0) {
      zeroBase.push(category)
    } else {
      rows.push({ category, unit, a: va, b: vb, pct: ((vb - va) / Math.abs(va)) * 100 })
    }
  }
  const parts = rows.map((r) => {
    const s = fixed(Math.abs(r.pct), 1)
    return s === '0.0' ? `${r.category} the same` : `${r.category} ${s}% ${r.pct < 0 ? 'lower' : 'higher'}`
  })
  const summary = [
    `${b.name} against ${a.name}, by impact category: ${parts.length ? parts.join('; ') : 'no category both runs computed'}.`,
    zeroBase.length ? `No percentage where ${a.name} is 0: ${zeroBase.join(', ')}.` : '',
    notCounted.length ? `Not counted: ${notCounted.map((n) => `${n.category} (no result in ${n.missingIn})`).join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
  return { rows, zeroBase, notCounted, why: null, summary }
}
