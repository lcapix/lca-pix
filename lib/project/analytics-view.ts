// What Analytics (E10) says about a class: how far the student cases got,
// where their latest results landed on one axis, and the flows most often
// left empty. Pure; read from the progress and empty-flows routes, so it
// cannot drift from the cases. Nothing here scores or grades.

import { answer } from '@/lib/ui/format'

export interface ClassCase {
  case_id: number
  case_name: string
  case_type: string
  created_by: number | null
  author: string | null
  has_interpretation: boolean
  is_final: boolean
  /** A frozen hand-in copy (migrate-043) and the working case it froze. */
  read_only?: boolean
  assignment_id?: number | null
  handed_in?: boolean
  working_case_id?: number | null
  latest_run: { run_id: number; method?: string | null; region?: string | null; headline: { value: number; unit: string } | null } | null
}

/** A frozen hand-in copy: counted through its working case, never as a case of its own. */
const isHandInCopy = (c: ClassCase) => !!c.handed_in || (!!c.read_only && c.assignment_id != null)

/** The cases students made: everyone's but the owner's and admins', without the hand-in copies. */
export function studentCases<C extends ClassCase>(cases: C[], staff: Set<number>): C[] {
  return cases.filter((c) => (c.created_by == null || !staff.has(c.created_by)) && !isHandInCopy(c))
}

/** The working cases that were handed in on an assignment (from the frozen copies). */
export function handedInIds(all: ClassCase[]): Set<number> {
  return new Set(all.filter((c) => isHandInCopy(c) && c.working_case_id != null).map((c) => Number(c.working_case_id)))
}

/** Handed in: on an assignment, or ticked "This is my hand-in" (the older way). */
const handed = (c: ClassCase, handedIn: Set<number>) => c.is_final || handedIn.has(c.case_id)

/** Ran: at least one completed run (a failed run is not a result). */
export function classCounts(cases: ClassCase[], handedIn: Set<number> = new Set()): { cases: number; ran: number; wrote: number; ticked: number; notRun: number } {
  const ran = cases.filter((c) => c.latest_run != null).length
  return {
    cases: cases.length,
    ran,
    wrote: cases.filter((c) => c.has_interpretation).length,
    ticked: cases.filter((c) => handed(c, handedIn)).length,
    notRun: cases.length - ran,
  }
}

export interface Dot {
  case_id: number
  who: string
  case_name: string
  value: number
  ticked: boolean
}

/**
 * One dot per student case with a run, at its latest total. A run under
 * another method or region than the base case's is a different measurement,
 * so it is left off the axis and counted.
 */
export function landed(cases: ClassCase[], scope: { method: string | null; region: string | null }, handedIn: Set<number> = new Set()): { dots: Dot[]; otherScope: number } {
  let otherScope = 0
  const dots: Dot[] = []
  for (const c of cases) {
    const r = c.latest_run
    if (!r?.headline || !Number.isFinite(r.headline.value)) continue
    if ((scope.method && r.method && r.method !== scope.method) || (scope.region && r.region && r.region !== scope.region)) {
      otherScope++
      continue
    }
    dots.push({ case_id: c.case_id, who: firstName(c.author) ?? c.case_name, case_name: c.case_name, value: r.headline.value, ticked: handed(c, handedIn) })
  }
  return { dots: dots.sort((a, b) => a.value - b.value), otherScope }
}

export function firstName(full: string | null | undefined): string | null {
  const t = (full ?? '').trim()
  if (!t) return null
  const parts = t.split(/\s+/)
  // "Dr. Omar Haddad" → "Omar".
  return /\.$/.test(parts[0]) && parts[1] ? parts[1] : parts[0]
}

/** Ticks on a step of 1, 2, 4 or 5 times a power of ten, about five of them, covering every value. */
export function axisTicks(values: number[]): { min: number; max: number; step: number; ticks: number[] } {
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.05 || 1
    lo -= pad
    hi += pad
  }
  const raw = (hi - lo) / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 4, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p)
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Number(t.toPrecision(12)))
  return { min, max, step, ticks }
}

/** Decimals that tell the ticks apart (a step of 0.04 needs 2). */
export function tickDecimals(step: number): number {
  return Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)))
}

/** "23 runs between 1.61 and 1.75. The base case is 1.72." */
export function landedLine(dots: Dot[], base: number | null): string {
  if (!dots.length) return 'No student case has a run yet.'
  const lo = answer(dots[0].value)
  const hi = answer(dots[dots.length - 1].value)
  const head = dots.length === 1 ? `1 run, at ${lo}.` : lo === hi ? `${dots.length} runs, all at ${lo}.` : `${dots.length} runs between ${lo} and ${hi}.`
  return base == null ? head : `${head} The base case is ${answer(base)}.`
}

/** Which dots carry a name: the ticked hand-ins, or the lowest and highest when fewer than two are ticked. */
export function labelled(dots: Dot[]): Set<number> {
  const ticked = dots.filter((d) => d.ticked).map((d) => d.case_id)
  if (ticked.length >= 2 || dots.length < 2) return new Set(ticked)
  return new Set([...ticked, dots[0].case_id, dots[dots.length - 1].case_id])
}

/**
 * Label rows so no two labels overlap: each label (centred on its x, about
 * `width` wide) goes on the first row whose last label ends before it.
 */
export function labelRows(items: Array<{ id: number; x: number; width: number }>, rows = 3): Map<number, number> {
  const ends: number[] = []
  const out = new Map<number, number>()
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    const left = it.x - it.width / 2
    let row = ends.findIndex((e) => e + 8 <= left)
    if (row === -1) row = ends.length < rows ? ends.length : ends.indexOf(Math.min(...ends))
    ends[row] = it.x + it.width / 2
    out.set(it.id, row)
  }
  return out
}

export interface EmptyRow {
  substance: string
  direction: 'input' | 'output'
  step: string
  cases: number
}

/** The flows most often left empty among the given cases (the ones that ran), most first. */
export function emptyRows(flows: Array<{ substance: string; direction: string; step: string; case_ids: number[] }>, among: Set<number>, top = 5): EmptyRow[] {
  return flows
    .map((f) => ({ substance: f.substance, direction: (f.direction === 'output' ? 'output' : 'input') as EmptyRow['direction'], step: f.step, cases: f.case_ids.filter((id) => among.has(id)).length }))
    .filter((r) => r.cases > 0)
    .sort((a, b) => b.cases - a.cases || a.substance.localeCompare(b.substance))
    .slice(0, top)
}
