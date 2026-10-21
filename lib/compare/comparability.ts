/**
 * Whether a set of runs may be compared, as four checks (ISO 14044 4.2.3.7:
 * comparisons need the same functional unit, method and system; a run must
 * describe the case as it is now). Compare shows the four checks; when any
 * fails, totals are greyed and change by step is hidden, because a difference
 * between such runs mixes the change being tested with the mismatch.
 *
 * Region is a check too: in this app the region picks the electricity factor,
 * so two regions would hide a grid change inside another change. A grid
 * what-if is modelled by changing the electricity input in the copy, within
 * one region.
 */

/** How many cases one comparison holds (the route and the page share it). */
export const COMPARE_MAX_CASES = 8

export type ComparabilityKey = 'method' | 'region' | 'functionalUnit' | 'current'

export interface ComparableCase {
  caseId: string
  name?: string | null
  run: {
    runId?: number | string | null
    method?: string | null
    region?: string | null
    functionalUnit?: string | null
  } | null
  /** The case changed after its run (the run no longer describes it). */
  editedSinceRun?: boolean
}

export interface ComparabilityCheck {
  key: ComparabilityKey
  ok: boolean
  /** "Same method", "Region differs: US vs Global". */
  label: string
  /** The value when it passes ("TRACI 2.1"), what to do when it fails. */
  detail: string
  /** Cases to act on when it fails (re-run these). */
  caseIds: string[]
}

export interface Comparability {
  checks: ComparabilityCheck[]
  /** At least two runs and every check passes. */
  fair: boolean
  /**
   * The runs measure the same way: method, region and functional unit agree.
   * Only a scope mismatch greys the totals (E09b); a case with no run or a
   * stale run is left out of the ranking on its own ("re-run to compare").
   */
  scopeFair: boolean
  failed: number
}

const distinct = (xs: string[]) => Array.from(new Set(xs))
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export function comparability(cases: ComparableCase[]): Comparability {
  const withRun = cases.filter((c) => c.run)
  const noRun = cases.filter((c) => !c.run)

  const methods = distinct(withRun.map((c) => clean(c.run!.method)).filter(Boolean))
  const regions = distinct(withRun.map((c) => clean(c.run!.region)).filter(Boolean))
  const fus = distinct(withRun.map((c) => clean(c.run!.functionalUnit)).filter(Boolean))
  const fuMissing = withRun.filter((c) => !clean(c.run!.functionalUnit))
  const stale = withRun.filter((c) => c.editedSinceRun)

  const method: ComparabilityCheck =
    methods.length <= 1
      ? { key: 'method', ok: true, label: 'Same method', detail: methods[0] ?? '–', caseIds: [] }
      : {
          key: 'method',
          ok: false,
          label: `Method differs: ${methods.join(' vs ')}`,
          detail: 'Run every case under one method.',
          caseIds: withRun.map((c) => c.caseId),
        }

  const region: ComparabilityCheck =
    regions.length <= 1
      ? { key: 'region', ok: true, label: 'Same region', detail: regions[0] ?? '–', caseIds: [] }
      : {
          key: 'region',
          ok: false,
          label: `Region differs: ${regions.join(' vs ')}`,
          detail: `Run every case in one region (${regions[0]}).`,
          caseIds: withRun.filter((c) => clean(c.run!.region) !== regions[0]).map((c) => c.caseId),
        }

  const functionalUnit: ComparabilityCheck =
    fus.length > 1
      ? {
          key: 'functionalUnit',
          ok: false,
          label: `Functional unit differs: ${fus.join(' vs ')}`,
          detail: 'Set one functional unit, then run every case again.',
          caseIds: withRun.map((c) => c.caseId),
        }
      : fuMissing.length > 0
        ? {
            key: 'functionalUnit',
            ok: false,
            label: 'Functional unit not recorded',
            detail: 'Set the goal and scope, then run these cases again.',
            caseIds: fuMissing.map((c) => c.caseId),
          }
        : { key: 'functionalUnit', ok: true, label: 'Same functional unit', detail: fus[0] ?? '–', caseIds: [] }

  const current: ComparabilityCheck =
    noRun.length > 0
      ? {
          key: 'current',
          ok: false,
          label: noRun.length === 1 ? 'A case has no run' : `${noRun.length} cases have no run`,
          detail: 'Run every case first.',
          caseIds: noRun.map((c) => c.caseId),
        }
      : stale.length > 0
        ? {
            key: 'current',
            ok: false,
            label: 'Run is older than the last change',
            detail: 'Run these cases again.',
            caseIds: stale.map((c) => c.caseId),
          }
        : { key: 'current', ok: true, label: 'Both runs current', detail: 'Not edited since the run', caseIds: [] }

  const checks = [method, region, functionalUnit, current]
  const failed = checks.filter((c) => !c.ok).length
  return {
    checks,
    failed,
    fair: withRun.length >= 2 && failed === 0,
    scopeFair: method.ok && region.ok && functionalUnit.ok,
  }
}
