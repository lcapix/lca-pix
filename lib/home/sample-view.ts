/**
 * The sample study's Overview (E02), sections 03 to 06, as words built from
 * the study's own numbers (acceptance check 2: "every number on it is one
 * LCAPIX computes"): the lines that go in, what the what-if changed, How sure
 * said in full, and the example write-up. Pure, so each sentence is tested.
 */

import { caseTotal, fixed } from '@/lib/ui/format'
import type { InventoryRow } from '@/lib/workspace/inventory'
import type { SureGroup } from '@/lib/workspace/results-view'

/** "Steel, cold-rolled" → "steel". */
const plain = (s: string) => s.split(',')[0].trim().toLowerCase()

function listWords(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/**
 * Section 03: the counted climate lines, largest first (at most `limit`), and
 * one sentence for the rest: the smaller counted lines, the flows with no
 * climate factor in the method, and any left out because a unit can't convert.
 */
export function whatGoesIn(rows: InventoryRow[], stepName: (id: number) => string, method: string, limit = 4) {
  const counted = rows.filter((r) => r.status === 'counted' && r.climate).sort((a, b) => b.climate!.impact - a.climate!.impact)
  const shown = counted.slice(0, limit)
  const rest = counted.slice(limit)
  const noFactor = rows.filter((r) => r.status === 'no_factor')
  const leftOut = rows.filter((r) => r.status === 'left_out')
  const needs = rows.filter((r) => r.status === 'needs_amount')
  const parts: string[] = []
  if (rest.length) {
    parts.push(
      `Plus ${listWords(rest.map((r) => `${stepName(r.component_id).replace(/^\d+\.\s*/, '').toLowerCase()} ${plain(r.substance)}, ${fixed(r.climate!.impact, 4).replace(/0+$/, '')}`))}.`,
    )
  }
  if (noFactor.length) {
    const names = [...new Set(noFactor.map((r) => plain(r.substance)))]
    parts.push(`${cap(listWords(names))} ${names.length === 1 ? 'has' : 'have'} no climate factor in ${method}, so ${names.length === 1 ? 'it adds' : 'they add'} nothing.`)
  }
  if (leftOut.length) {
    const names = [...new Set(leftOut.map((r) => plain(r.substance)))]
    parts.push(`${cap(listWords(names))} ${names.length === 1 ? 'is' : 'are'} left out: ${names.length === 1 ? 'its unit' : 'their units'} can't convert.`)
  }
  if (needs.length) parts.push(`${needs.length} ${needs.length === 1 ? 'flow has' : 'flows have'} no amount yet.`)
  return { shown, footnote: parts.join(' ') }
}

export interface FlowAmount {
  step: string
  substance: string
  direction: 'input' | 'output'
  amount: number | null
  unit: string
}

/**
 * Section 05, What changed: the flows whose amount differs between the base
 * case and the what-if (matched by step, substance and direction), and the
 * sentence: "0.053 kg less, all from 30. Powder coat and cure: its electricity
 * went from 0.40 to 0.25 kWh."
 */
export function whatChanged(base: FlowAmount[], whatIf: FlowAmount[], baseTotal: number, whatIfTotal: number, unit = 'kg') {
  const key = (f: FlowAmount) => `${f.step}|${f.substance}|${f.direction}`
  const was = new Map(base.map((f) => [key(f), f]))
  const changes = whatIf
    .filter((f) => was.has(key(f)) && was.get(key(f))!.amount !== f.amount)
    .map((f) => ({ ...f, from: was.get(key(f))!.amount }))
  const added = whatIf.filter((f) => !was.has(key(f)))
  const gone = base.filter((f) => !whatIf.some((g) => key(g) === key(f)))
  const delta = Number(fixed(whatIfTotal, 3)) - Number(fixed(baseTotal, 3))
  const size = `${fixed(Math.abs(delta), 3)} ${unit} ${delta < 0 ? 'less' : 'more'}`
  if (Math.abs(delta) < 0.0005 && !changes.length && !added.length && !gone.length) return { changes, sentence: 'Nothing differs from the base case yet.' }
  const box = (v: number | null) => (v === null ? 'no amount' : fixed(v, 2))
  if (changes.length === 1 && !added.length && !gone.length) {
    const c = changes[0]
    return {
      changes,
      sentence: `${size}, all from ${c.step}: its ${plain(c.substance)} went from ${box(c.from)} to ${box(c.amount)} ${c.unit}.`,
    }
  }
  const n = changes.length + added.length + gone.length
  return { changes, sentence: `${size}, from ${n} ${n === 1 ? 'change' : 'changes'} to the inventory.` }
}

/** "How sure: 88% rests on one Global average, for steel, because there is no US value. Read 1.72 as …" */
export function howSureLong(sentence: string, groups: SureGroup[], region: string, total: number, caseType: string): string {
  const top = groups[0]
  const reason = top?.kind === 'global' && region && region.toLowerCase() !== 'global' ? `, because there is no ${region} value` : ''
  const base = sentence.replace(/\.$/, '')
  const shown = caseTotal(total, caseType)
  const read =
    top && top.kind !== 'regional' && top.kind !== 'supplier' && top.fraction > 0.5
      ? ` Read ${shown} as a sound estimate of where the impact sits, not a precise total.`
      : ` Read ${shown} as a sound estimate.`
  return `How sure: ${base}${reason}.${read}`
}

/**
 * Section 06, the example write-up (not saved to the case): the answer, where
 * it comes from, how sure, and what the what-if did, in one paragraph.
 */
export function exampleWriteUp(o: {
  total: number
  unit: string
  perUnit: string
  answerSentence: string | null
  sure: { pct: number; what: string } | null
  whatIf: { name: string; pct: string; lower: boolean; allFrom: string | null } | null
}): string {
  const parts = [`One ${o.perUnit} is ${caseTotal(o.total, 'base')} ${o.unit}.`]
  if (o.answerSentence) parts.push(o.answerSentence.replace(/\.$/, ''))
  if (o.sure) {
    const last = parts.pop()!
    parts.push(`${last}, and ${o.sure.pct}% rests on ${o.sure.what}, so the total is an estimate while the ranking holds.`)
  } else if (parts.length > 1) {
    parts[parts.length - 1] += '.'
  }
  if (o.whatIf) {
    parts.push(
      `${o.whatIf.name} ${o.whatIf.lower ? 'saves' : 'adds'} ${o.whatIf.pct}${o.whatIf.allFrom ? `, all of it ${o.whatIf.allFrom}` : ''}.`,
    )
  }
  return parts.join(' ')
}
