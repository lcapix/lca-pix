/**
 * The Results tab's words and numbers (E05, rules.md "Words" and "Facts"),
 * from one run: the answer, "89% comes from 10. Cut blank, almost all of it
 * steel", What builds this number (by operation, the run's own tree), How sure
 * ("88% rests on one Global average, for steel"), the note against the Base
 * case, and Cost beside impact. Pure, so every phrase is tested.
 */

import { caseTotal, fixed, share } from '@/lib/ui/format'
import { isClimate, sourceKindOf } from '@/lib/workspace/inventory'
import type { SourceKind } from '@/lib/ui/words'

export interface RunStep {
  component_id: number
  name: string
  parent_id: number | null
  type: string
  cost: number | null
  currency?: string | null
}

export interface RunFlow {
  component_id?: number | null
  substance: string
  category_name: string
  impact: number
  scope?: string | null
  source?: string | null
}

export interface RunInput {
  run_id: number
  impacts: Record<string, { value: number; unit: string }>
  componentBreakdown: Array<{ component_id: number; impacts: Array<{ category_name: string; impact_value: number }> }>
  flowDetail: RunFlow[]
  run_steps?: RunStep[]
  regionCode?: string
}

/** The run's climate total and unit, or null when the method has none. */
export function runClimate(run: Pick<RunInput, 'impacts'>): { name: string; value: number; unit: string } | null {
  const key = Object.keys(run.impacts ?? {}).find(isClimate)
  return key ? { name: key, value: run.impacts[key].value, unit: run.impacts[key].unit } : null
}

/** Each step's own climate value in the run. */
export function ownClimate(run: Pick<RunInput, 'componentBreakdown'>): Map<number, number> {
  const out = new Map<number, number>()
  for (const c of run.componentBreakdown ?? []) {
    const v = c.impacts.find((i) => isClimate(i.category_name))?.impact_value
    if (v) out.set(Number(c.component_id), Number(v))
  }
  return out
}

/** A value per step summed over the subtree under it (cycles counted once). */
export function subtreeSums(steps: Array<{ id: number; parentId: number | null }>, own: Map<number, number>): Map<number, number> {
  const kids = new Map<number, number[]>()
  for (const s of steps) if (s.parentId != null) kids.set(s.parentId, [...(kids.get(s.parentId) ?? []), s.id])
  const out = new Map<number, number>()
  const total = (id: number, seen: Set<number>): number => {
    if (out.has(id)) return out.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const t = (own.get(id) ?? 0) + (kids.get(id) ?? []).reduce((a, k) => a + total(k, seen), 0)
    out.set(id, t)
    return t
  }
  for (const s of steps) total(s.id, new Set())
  return out
}

export interface BuildRow {
  component_id: number
  name: string
  value: number
  /** "89.4%" of the total as shown. */
  share: string
  /** 0..1 for the bar. */
  fraction: number
}

const toTree = (rs: RunStep[]) => rs.map((s) => ({ id: s.component_id, parentId: s.parent_id }))

/**
 * What builds this number: each operation with everything under it, largest
 * first (rules.md: by operation, "10. Cut blank 1.538 (89.4%)"). A tree with
 * no operations falls back to the steps that carry a value themselves.
 */
export function whatBuilds(run: RunInput, caseType: string): BuildRow[] {
  const climate = runClimate(run)
  if (!climate) return []
  const shown = Number(caseTotal(climate.value, caseType))
  const own = ownClimate(run)
  const steps = run.run_steps ?? []
  const sums = subtreeSums(toTree(steps), own)
  let pick = steps.filter((s) => s.type === 'operation')
  if (!pick.length) pick = steps.filter((s) => (own.get(s.component_id) ?? 0) !== 0)
  return pick
    .map((s) => {
      const value = sums.get(s.component_id) ?? 0
      return {
        component_id: s.component_id,
        name: s.name,
        value,
        share: share(Number(fixed(value, 3)), shown),
        fraction: climate.value ? Math.max(0, Math.min(1, value / climate.value)) : 0,
      }
    })
    .sort((a, b) => b.value - a.value)
}

/** The steps under (and including) one step in the run's tree. */
function subtreeIds(steps: RunStep[], rootId: number): Set<number> {
  const ids = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const s of steps) {
      if (s.parent_id != null && ids.has(s.parent_id) && !ids.has(s.component_id)) {
        ids.add(s.component_id)
        grew = true
      }
    }
  }
  return ids
}

/** "Steel, cold-rolled" → "steel". */
const plainSubstance = (name: string) => name.split(',')[0].trim().toLowerCase()

/** "89% comes from 10. Cut blank, almost all of it steel." */
export function answerSentence(run: RunInput, builds: BuildRow[]): string | null {
  const top = builds[0]
  const climate = runClimate(run)
  if (!top || !climate || top.value <= 0) return null
  const pct = Math.round(top.fraction * 100)
  const ids = subtreeIds(run.run_steps ?? [], top.component_id)
  const bySubstance = new Map<string, number>()
  for (const f of run.flowDetail ?? []) {
    if (!isClimate(f.category_name) || f.component_id == null || !ids.has(Number(f.component_id))) continue
    bySubstance.set(f.substance, (bySubstance.get(f.substance) ?? 0) + Number(f.impact))
  }
  const [main] = [...bySubstance.entries()].sort((a, b) => b[1] - a[1])
  const lead = `${pct}% comes from ${top.name}`
  if (!main) return `${lead}.`
  const part = main[1] / top.value
  if (part >= 0.9) return `${lead}, almost all of it ${plainSubstance(main[0])}.`
  if (part >= 0.5) return `${lead}, most of it ${plainSubstance(main[0])}.`
  return `${lead}.`
}

export interface SureGroup {
  kind: SourceKind
  share: string
  fraction: number
  substances: string[]
}

const KIND_ORDER: SourceKind[] = ['global', 'regional', 'supplier', 'hand', 'reference']
const KIND_PHRASE: Record<SourceKind, [string, string]> = {
  global: ['one Global average', 'Global averages'],
  regional: ['one Regional factor', 'Regional factors'],
  supplier: ["one supplier's declaration", "suppliers' declarations"],
  hand: ['one number entered by hand', 'numbers entered by hand'],
  reference: ['one reference value', 'reference values'],
}

/**
 * How sure: the climate total split by where its factors come from, and the
 * one plain sentence on the largest part ("88% rests on one Global average,
 * for steel"). Shares are of the total as shown.
 */
export function howSure(run: RunInput, caseType: string): { sentence: string; groups: SureGroup[] } | null {
  const climate = runClimate(run)
  if (!climate || !climate.value) return null
  const shown = Number(caseTotal(climate.value, caseType))
  const groups = new Map<SourceKind, { value: number; substances: Set<string> }>()
  for (const f of run.flowDetail ?? []) {
    if (!isClimate(f.category_name) || !f.impact) continue
    const kind = sourceKindOf({ scope: f.scope ?? null, source: f.source ?? null })
    const g = groups.get(kind) ?? { value: 0, substances: new Set<string>() }
    g.value += Number(f.impact)
    g.substances.add(plainSubstance(f.substance))
    groups.set(kind, g)
  }
  const list = [...groups.entries()]
    .map(([kind, g]) => ({
      kind,
      share: share(Number(fixed(g.value, 3)), shown),
      fraction: g.value / climate.value,
      substances: [...g.substances],
    }))
    .sort((a, b) => b.fraction - a.fraction || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  if (!list.length) return null
  const top = list[0]
  const n = top.substances.length
  const what = n === 1 ? KIND_PHRASE[top.kind][0] : `${n} ${KIND_PHRASE[top.kind][1]}`
  const names = n <= 3 ? `, for ${listWords(top.substances)}` : ''
  return { sentence: `${Math.round(top.fraction * 100)}% rests on ${what}${names}.`, groups: list }
}

function listWords(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/**
 * The note against the case it is measured from (the Base case, or the case it
 * was copied from): "Same as the Base case, Run #101" / "0.053 lower than the
 * Base case, Run #301" with "3.1% lower". Compared at the 3 decimals shown.
 */
export function compareNote(
  thisTotal: number,
  other: { label: string; run_id: number; total: number },
  isCopy: boolean,
): { chip: string; note: string } {
  const a = Number(fixed(thisTotal, 3))
  const b = Number(fixed(other.total, 3))
  const diff = Number(fixed(a - b, 3))
  // An empty label is the case's own previous run: "Same as Run #100".
  const against = other.label ? `the ${other.label}, Run #${other.run_id}` : `Run #${other.run_id}`
  if (diff === 0) return { chip: `Same as ${against}`, note: isCopy ? 'Nothing in your copy differs yet.' : 'The two totals agree.' }
  const word = diff < 0 ? 'lower' : 'higher'
  const pct = b ? `${fixed((Math.abs(diff) / b) * 100, 1)}% ${word}` : ''
  return { chip: `${fixed(Math.abs(diff), 3)} ${word} than ${against}`, note: pct }
}

export interface CostRow {
  component_id: number
  name: string
  cost: number
  share: string
  impact: number
}

/**
 * Cost beside impact, from the run's frozen steps: the total and one row per
 * operation that carries a cost (with its impact), largest cost first.
 */
export function costBeside(run: RunInput): { total: number; currency: string; rows: CostRow[] } | null {
  const steps = run.run_steps ?? []
  const own = new Map(steps.filter((s) => s.cost != null).map((s) => [s.component_id, Number(s.cost)]))
  if (!own.size) return null
  const tree = toTree(steps)
  const costs = subtreeSums(tree, own)
  const impacts = subtreeSums(tree, ownClimate(run))
  const total = [...own.values()].reduce((t, v) => t + v, 0)
  const shownTotal = Number(fixed(total, 2))
  let pick = steps.filter((s) => s.type === 'operation')
  if (!pick.length) pick = steps.filter((s) => own.has(s.component_id))
  const rows = pick
    .map((s) => ({
      component_id: s.component_id,
      name: s.name,
      cost: costs.get(s.component_id) ?? 0,
      share: share(Number(fixed(costs.get(s.component_id) ?? 0, 2)), shownTotal),
      impact: impacts.get(s.component_id) ?? 0,
    }))
    .filter((r) => r.cost > 0)
    .sort((a, b) => b.cost - a.cost)
  return { total, currency: steps.find((s) => s.currency)?.currency ?? 'USD', rows }
}

/** The other categories of the run, for "Show the other N categories". */
export function otherCategories(run: Pick<RunInput, 'impacts'>): Array<{ name: string; value: number; unit: string }> {
  return Object.entries(run.impacts ?? {})
    .filter(([k]) => !isClimate(k))
    .map(([name, v]) => ({ name, value: v.value, unit: v.unit }))
}

/** The short form on the Write-up (E06): "▼ 2.2% vs the Base case"; equal: "Same as the Base case". */
export function deltaChip(thisTotal: number, other: { label: string; total: number }): string {
  const a = Number(fixed(thisTotal, 3))
  const b = Number(fixed(other.total, 3))
  const against = other.label ? `the ${other.label}` : 'the previous run'
  if (a === b || !b) return `Same as ${against}`
  return `${a < b ? '▼' : '▲'} ${fixed((Math.abs(a - b) / b) * 100, 1)}% vs ${against}`
}
