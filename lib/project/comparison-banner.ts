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
 * for every number that compares two runs: this line, Compare's totals chip,
 * Ranking, verdict and change by category (lib/compare/verdict.ts), the
 * Results tab's and the Write-up's note against the base (whyNoChange below)
 * and the exported report. A method, region or functional unit difference
 * stops the number, and so do a stale or incomplete run.
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

/** One run as the Results tab, the Write-up and the report know it. */
export interface RunBasis {
  /** The case's name, for the reason ("Base case has no complete run yet."). */
  name: string
  method: string | null | undefined
  region: string | null | undefined
  /** The run's functional unit; leave out when it is the same study's and not known here. */
  functionalUnit?: string | null
  /** The case changed after this run. */
  stale?: boolean
}

/**
 * Why a run gives no percentage against another run (the Base case's, or
 * the case it was copied from), or null when it may. The same rule as
 * whyNoNumber: it builds the two cases and asks it. Where the caller does not
 * know the functional unit (both runs belong to one study, whose unit is
 * read at run time), the two runs are taken to share it, so only method,
 * region and staleness decide.
 */
export function whyNoChange(run: RunBasis, against: RunBasis): string | null {
  const fuKnown = run.functionalUnit !== undefined && against.functionalUnit !== undefined
  const fu = (r: RunBasis) => (fuKnown ? (r.functionalUnit ?? null) : 'the study\u2019s functional unit')
  const asCase = (r: RunBasis, id: string): CheckedCase => ({
    caseId: id,
    name: r.name,
    status: r.stale ? 'stale' : 'ok',
    run: { runId: 0, method: r.method ?? null, region: r.region ?? 'Global', functionalUnit: fu(r), stale: !!r.stale },
  })
  return whyNoNumber(asCase(against, 'against'), asCase(run, 'run'))
}
