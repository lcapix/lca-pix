/**
 * The Overview's comparison line (P13): the base case against its first copy,
 * read from GET /api/projects/:id/compare. It says something only when the
 * two runs are fair to compare (same method, region and functional unit, both
 * run and up to date); otherwise it names the two cases and says why there is
 * no number yet. It never shows a number the runs did not produce.
 */

import { comparability } from '@/lib/compare/comparability'
import { money, share } from '@/lib/ui/format'

interface BannerCase {
  caseId: string
  name: string
  isBase?: boolean
  status?: string
  run: { runId: number; method: string | null; region: string | null; functionalUnit: string | null; stale?: boolean } | null
  totals: Array<{ category: string; unit: string; value: number }>
  costs: Array<Record<string, number | string>>
}

export interface ComparisonBanner {
  base: string
  other: string
  /** "4.1% lower climate impact · $0.12 less cost", or null when there is no fair number. */
  line: string | null
  /** Why there is no number ("Region differs: US vs Global"), or null. */
  why: string | null
}

const CLIMATE = /global warming|climate/i
const COST_KEYS = ['labor', 'energy', 'material', 'transportation', 'equipment', 'overhead']

const climateOf = (c: BannerCase) => c.totals.find((t) => CLIMATE.test(t.category))?.value
const costOf = (c: BannerCase) =>
  c.costs.reduce((t, row) => t + COST_KEYS.reduce((s, k) => s + (Number(row[k]) || 0), 0), 0)

/** The fields the comparability rule reads from a case. */
export type CheckedCase = Pick<BannerCase, 'caseId' | 'name' | 'status' | 'run'>

/**
 * Why two cases give no number side by side, or null when they may. One rule
 * for every headline number: this line, and Compare's verdict and change by
 * category (lib/compare/verdict.ts). A headline: a region difference, which
 * Compare shows as a warning beside its totals, stops the number here, and so
 * does an incomplete run.
 */
export function whyNoNumber(base: CheckedCase, other: CheckedCase): string | null {
  const checks = comparability(
    [base, other].map((c) => ({
      caseId: c.caseId,
      name: c.name,
      run: c.run ? { runId: c.run.runId, method: c.run.method, region: c.run.region, functionalUnit: c.run.functionalUnit } : null,
      editedSinceRun: c.status === 'stale' || !!c.run?.stale,
    })),
  )
  const failed = checks.checks.find((k) => !k.ok)
  if (failed) return failed.label
  const incomplete = [base, other].find((c) => c.status === 'incomplete')
  if (incomplete) return `${incomplete.name} has no complete run yet.`
  return checks.fair ? null : 'Run both cases to compare them.'
}

export function comparisonBanner(cases: BannerCase[]): ComparisonBanner | null {
  const base = cases.find((c) => c.isBase) ?? cases[0]
  const other = cases.find((c) => c !== base)
  if (!base || !other) return null
  const blocked = whyNoNumber(base, other)
  const a = climateOf(base)
  const b = climateOf(other)
  if (blocked || a === undefined || b === undefined) {
    return { base: base.name, other: other.name, line: null, why: blocked ?? 'Run both cases to compare them.' }
  }
  const parts: string[] = []
  const da = Math.abs(b - a)
  parts.push(b === a ? 'the same climate impact' : `${share(da, Math.abs(a))} ${b < a ? 'lower' : 'higher'} climate impact`)
  const ca = costOf(base)
  const cb = costOf(other)
  if (ca || cb) parts.push(cb === ca ? 'the same cost' : `${money(Math.abs(cb - ca))} ${cb < ca ? 'less' : 'more'} cost`)
  return { base: base.name, other: other.name, line: parts.join(' · '), why: null }
}
