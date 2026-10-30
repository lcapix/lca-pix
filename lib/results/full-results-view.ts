/**
 * The full results page's numbers that are not in the Results tab: cost by
 * kind from the run's frozen steps, the base case's comparable run, the change
 * against it, and the step diff. Everything reads the run as it was frozen, so
 * the page never mixes a run's impacts with today's costs. Pure, so tested.
 */

import { fixed, share } from '@/lib/ui/format'
import type { RunStep } from '@/lib/workspace/results-view'

/** "Run 2": the run's place in its own case (2.8). "Run #57" only when the number is unknown. */
export function runLabel(r: { run_id: number; case_run_number?: number | null }): string {
  return r.case_run_number ? `Run ${r.case_run_number}` : `Run #${r.run_id}`
}

/** A run's place among `runs` of one case, oldest first, for lists that hold the whole history. */
export function caseRunNumber(runs: Array<{ run_id: number }>, runId: number): number {
  const ordered = [...runs].sort((a, b) => a.run_id - b.run_id)
  const i = ordered.findIndex((r) => r.run_id === runId)
  return i < 0 ? 1 : i + 1
}

export const COST_KINDS = [
  { key: 'labor', label: 'Labour' },
  { key: 'energy', label: 'Energy' },
  { key: 'material', label: 'Material' },
  { key: 'transportation', label: 'Transport' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'overhead', label: 'Overhead' },
] as const

export interface RunCosts {
  total: number
  currency: string
  kinds: Array<{ kind: string; amount: number }>
}

/**
 * The run's costs as frozen: each step's own cost, summed. Null when the run
 * froze no cost (an older run, or a case with no cost entered), so the page
 * says so instead of showing $0.00.
 */
export function runCosts(steps: RunStep[] | undefined): RunCosts | null {
  const priced = (steps ?? []).filter((s) => s.cost != null && Number.isFinite(Number(s.cost)))
  if (!priced.length) return null
  const total = priced.reduce((t, s) => t + Number(s.cost), 0)
  const withKinds = priced.some((s) => s.kinds)
  const kinds = withKinds
    ? COST_KINDS.map(({ key, label }) => ({
        kind: label,
        amount: priced.reduce((t, s) => t + Number(s.kinds?.[key] ?? 0), 0),
      }))
    : []
  return { total, currency: priced.find((s) => s.currency)?.currency ?? 'USD', kinds }
}

interface Comparable {
  run_id: number
  calculation_method: string
  regionCode?: string
}

const sameBasis = (a: Comparable, b: Comparable) =>
  a.calculation_method === b.calculation_method && (a.regionCode ?? 'Global') === (b.regionCode ?? 'Global')

/**
 * The newest run of `others` made with the same method and region as `run`.
 * A change is only read between runs on the same basis.
 */
export function comparableRun<T extends Comparable>(others: T[], run: Comparable): T | null {
  return [...others].filter((r) => sameBasis(r, run)).sort((a, b) => b.run_id - a.run_id)[0] ?? null
}

/** The last run of the same case before `run`, on the same basis. */
export function previousComparable<T extends Comparable>(runs: T[], run: Comparable): T | null {
  return comparableRun(
    runs.filter((r) => r.run_id < run.run_id),
    run,
  )
}

/** "up 4.2%", "down 4.2%" or "the same", read at the decimals a person sees. */
export function changeWords(value: number, against: number): string {
  if (!against) return 'no base value to compare'
  const a = Number(fixed(value, 3))
  const b = Number(fixed(against, 3))
  if (a === b) return 'the same'
  return `${a < b ? 'down' : 'up'} ${share(Math.abs(a - b), Math.abs(b))}`
}

export interface StepDiffRow {
  path: string
  name: string
  mine: number | null
  theirs: number | null
  diff: number
}

interface DiffRun {
  componentBreakdown: Array<{ component_id: number; component_name: string; impacts: Array<{ category_name: string; impact_value: number }> }>
  run_steps?: RunStep[]
}

/** Each step's path of names from the top ("Bracket / Cut blank"); the id's name when the tree is unknown. */
function paths(run: DiffRun): Map<number, string> {
  const byId = new Map((run.run_steps ?? []).map((s) => [s.component_id, s]))
  const out = new Map<number, string>()
  for (const c of run.componentBreakdown) {
    const names: string[] = []
    let at = byId.get(c.component_id)
    const seen = new Set<number>()
    while (at && !seen.has(at.component_id)) {
      seen.add(at.component_id)
      names.unshift(at.name)
      at = at.parent_id != null ? byId.get(at.parent_id) : undefined
    }
    out.set(c.component_id, names.length ? names.join(' / ') : c.component_name)
  }
  return out
}

function valuesByPath(run: DiffRun, category: string): Map<string, { name: string; value: number }> {
  const p = paths(run)
  const out = new Map<string, { name: string; value: number }>()
  for (const c of run.componentBreakdown) {
    const v = c.impacts.find((i) => i.category_name === category)?.impact_value
    if (v === undefined) continue
    const key = p.get(c.component_id) ?? c.component_name
    const had = out.get(key)
    out.set(key, { name: c.component_name, value: (had?.value ?? 0) + Number(v) })
  }
  return out
}

/**
 * Step by step against the base case. A comparative case is a copy, so its
 * steps have new ids; they are matched by their path of names, as Compare
 * does. A step on one side only shows the other side as null.
 */
export function stepDiffRows(run: DiffRun, base: DiffRun, category: string): StepDiffRow[] {
  const mine = valuesByPath(run, category)
  const theirs = valuesByPath(base, category)
  const keys = [...mine.keys(), ...[...theirs.keys()].filter((k) => !mine.has(k))]
  return keys.map((path) => {
    const m = mine.get(path)
    const t = theirs.get(path)
    return {
      path,
      name: m?.name ?? t!.name,
      mine: m ? m.value : null,
      theirs: t ? t.value : null,
      diff: (m?.value ?? 0) - (t?.value ?? 0),
    }
  })
}

/** Each step's cost as the run froze it, in the shape Magic Insights reads (no step = no cost). */
export function frozenStepCosts(steps: RunStep[] | undefined) {
  return (steps ?? [])
    .filter((s) => s.kinds)
    .map((s) => ({
      id: String(s.component_id),
      name: s.name,
      labor: s.kinds?.labor ?? 0,
      material: s.kinds?.material ?? 0,
      energy: s.kinds?.energy ?? 0,
      other: (s.kinds?.transportation ?? 0) + (s.kinds?.equipment ?? 0) + (s.kinds?.overhead ?? 0),
    }))
}

export const CLIMATE = 'Global Warming'

interface FlowRowLike {
  flow_id: number
  category_name: string
  dir: 'IN' | 'OUT'
}

/**
 * K03: the input flows a run counted in climate only (materials carry a
 * climate factor and nothing else). In any other category they read
 * "climate only", not a silent gap. One row per flow, its climate row.
 */
export function climateOnlyFlows<T extends FlowRowLike>(rows: T[] | undefined): T[] {
  const cats = new Map<number, Set<string>>()
  for (const r of rows ?? []) {
    const set = cats.get(r.flow_id) ?? new Set<string>()
    set.add(r.category_name.toLowerCase())
    cats.set(r.flow_id, set)
  }
  const seen = new Set<number>()
  return (rows ?? []).filter((r) => {
    if (r.dir !== 'IN' || seen.has(r.flow_id)) return false
    const set = cats.get(r.flow_id)!
    if (set.size !== 1 || !set.has(CLIMATE.toLowerCase())) return false
    seen.add(r.flow_id)
    return true
  })
}
