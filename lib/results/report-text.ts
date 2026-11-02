/**
 * What the exported report (PDF and PowerPoint) says about the run, the
 * person and the comparison against the base (G1). Pure, so every line a
 * reader sees is tested.
 *
 * - The run is named the way the app names it ("Run 3"), never by its raw id
 *   or a timestamp run name ("Assessment-1793573399243").
 * - "Prepared by" is a person's name, never a username slug.
 * - The sample's "make your own copy to change it" sentence is left out of
 *   everything printed for a case that can be changed (C2).
 * - A comparative case carries its comparison against the base: both totals,
 *   the change, and the comparability verdict. The percentage follows the one
 *   rule every screen uses (whyNoNumber): none across methods, regions or
 *   functional units, or from a run older than the last change.
 */

import { changePct } from '@/lib/compare/compare-view'
import { whyNoNumber } from '@/lib/project/comparison-banner'
import { fixed } from '@/lib/ui/format'

/** "Run 3"; "Run #57" only when the run's place in its case is not known. */
export function reportRunLabel(a: { run_id: number; case_run_number?: number | null }): string {
  return a.case_run_number ? `Run ${a.case_run_number}` : `Run #${a.run_id}`
}

/** A person's name for "Prepared by": the first real name given, never a username. */
export function preparedBy(...names: Array<string | null | undefined>): string {
  return names.map((n) => (n ?? '').trim()).find(Boolean) ?? 'Name not given'
}

// The sample study's read-only sentences (lib/sample/sample-study.ts), as
// written there and as a copy of the sample carries them.
const READ_ONLY_SENTENCES = [
  /\s*The sample study\.\s*Read-only:\s*make your own copy to change it\.?/gi,
  /\s*Read-only:\s*make your own copy to change it\.?/gi,
  /\s*Make your own copy to change it\.?/gi,
]

/**
 * `text` without the sample's read-only sentences when the case can be
 * changed; as it is on the read-only sample itself. Null when nothing is left.
 */
export function withoutReadOnlyNote(text: string | null | undefined, editable: boolean): string | null {
  if (text === null || text === undefined) return null
  if (!editable) return text
  const out = READ_ONLY_SENTENCES.reduce((t, re) => t.replace(re, ''), text).trim()
  return out || null
}

export interface ReportRunSide {
  caseName: string
  runId: number
  caseRunNumber: number | null
  method: string | null
  region: string | null
  functionalUnit: string | null
  /** The case changed after this run. */
  stale: boolean
  /** Per functional unit. */
  totals: Array<{ category: string; unit: string; value: number }>
}

export interface ReportComparison {
  baseCase: string
  baseRun: string
  baseMethod: string
  baseRegion: string
  /** "Comparable: ..." or "Not comparable: Method differs: CML 2001 vs TRACI 2.1." */
  verdict: string
  comparable: boolean
  rows: Array<{
    category: string
    unit: string
    base: number | null
    mine: number | null
    /** mine minus base, only when comparable. */
    change: number | null
    /** Percent of the base, only when comparable and the base is not 0. */
    pct: number | null
  }>
}

/** This run against the base case's run, for the report. */
export function reportComparison(mine: ReportRunSide, base: ReportRunSide): ReportComparison {
  const asCase = (s: ReportRunSide, id: string) => ({
    caseId: id,
    name: s.caseName,
    status: s.stale ? 'stale' : 'ok',
    run: { runId: s.runId, method: s.method, region: s.region ?? 'Global', functionalUnit: s.functionalUnit, stale: s.stale },
  })
  const why = whyNoNumber(asCase(base, 'base'), asCase(mine, 'mine'))
  const comparable = !why
  const categories: Array<{ category: string; unit: string }> = []
  for (const t of [...mine.totals, ...base.totals]) {
    if (!categories.some((c) => c.category === t.category)) categories.push({ category: t.category, unit: t.unit })
  }
  const valueIn = (s: ReportRunSide, category: string) => {
    const rows = s.totals.filter((t) => t.category === category)
    return rows.length ? rows.reduce((sum, t) => sum + t.value, 0) : null
  }
  const rows = categories.map(({ category, unit }) => {
    const b = valueIn(base, category)
    const m = valueIn(mine, category)
    const both = comparable && b !== null && m !== null
    return {
      category,
      unit,
      base: b,
      mine: m,
      change: both ? m! - b! : null,
      pct: both ? changePct(m, b) : null,
    }
  })
  return {
    baseCase: base.caseName,
    baseRun: reportRunLabel({ run_id: base.runId, case_run_number: base.caseRunNumber }),
    baseMethod: base.method ?? 'method not recorded',
    baseRegion: base.region ?? 'Global',
    verdict: comparable
      ? 'Comparable: the same method, region and functional unit, and both runs describe their cases as they are now.'
      : `Not comparable: ${why!.replace(/\.$/, '')}. Both totals are shown as each run computed them, with no change or percentage between them.`,
    comparable,
    rows,
  }
}

/** "−0.190 (11.0% lower)", "+0.020 (1.2% higher)", "the same"; "not comparable" without a number. */
export function changeText(row: ReportComparison['rows'][number], fmt: (n: number) => string): string {
  if (row.change === null) return row.base === null || row.mine === null ? 'not in both runs' : 'not comparable'
  if (row.pct !== null && fixed(Math.abs(row.pct), 1) === '0.0') return 'the same'
  const signed = `${row.change < 0 ? '−' : '+'}${fmt(Math.abs(row.change))}`
  if (row.pct === null) return signed
  return `${signed} (${fixed(Math.abs(row.pct), 1)}% ${row.pct < 0 ? 'lower' : 'higher'})`
}
