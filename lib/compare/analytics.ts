// Comparison analytics over stored runs, the views LCA tools put side by side:
// an LCIA results table (absolute, change against the base, relative to the
// largest), where a change comes from (by step or by material), a hotspot
// matrix with a threshold (GaBi's weak point analysis highlights contributions
// over 10%), and cost set against impact.
//
// Every number is arithmetic on the runs' own results. Pure module: no DB.

import { COST_KEYS, type CostKey } from '@/lib/compare/diff'

export interface CaseResult {
  caseId: string
  name: string
  /** flowCount (frozen runs): flows behind the total; 0 means nothing was computed. */
  totals: Array<{ category: string; unit: string; value: number; flowCount?: number }>
  /** Per step (the component the run booked the result on). */
  byStep: Array<{ step: string; category: string; value: number }>
  /** Per exchange, from the run snapshot. Empty for runs without one. */
  flows: Array<{ step: string; substance: string; category: string; value: number }>
  /** Current step costs, per functional unit. */
  costs: Array<{ step: string } & Record<CostKey, number>>
}

export type Grouping = 'step' | 'material'

const sumBy = <T,>(rows: T[], key: (r: T) => string, val: (r: T) => number) => {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r))
  return m
}

export function totalOf(c: CaseResult, category: string): number {
  return c.totals.filter((t) => t.category === category).reduce((s, t) => s + t.value, 0)
}

/**
 * Change of `value` against `base`, in % of the size of the base. Dividing by
 * the signed base would flip the sign for a net-negative result (a credit or
 * sequestration): -20 against -10 is 100% lower, not 100% higher.
 */
export function pctChange(value: number, base: number | null | undefined): number | null {
  if (base === null || base === undefined || !Number.isFinite(base) || base === 0 || !Number.isFinite(value)) {
    return null
  }
  return ((value - base) / Math.abs(base)) * 100
}

export interface ResultsRow {
  category: string
  unit: string
  cells: Array<{
    caseId: string
    value: number | null
    /** other - base, in the category unit (null for the base or a missing value). */
    delta: number | null
    /** Change against the base, % of the base value. */
    deltaPct: number | null
    /** Share of the largest value in this row, 0-100 (openLCA's relative results). */
    relMax: number | null
  }>
}

/** LCIA results, one row per category, one cell per case. */
export function resultsTable(cases: CaseResult[], baseId: string): ResultsRow[] {
  const categories: Array<{ category: string; unit: string }> = []
  for (const c of cases) {
    for (const t of c.totals) {
      if (!categories.some((k) => k.category === t.category)) categories.push({ category: t.category, unit: t.unit })
    }
  }
  const base = cases.find((c) => c.caseId === baseId)
  return categories.map(({ category, unit }) => {
    const values = cases.map((c) => (c.totals.some((t) => t.category === category) ? totalOf(c, category) : null))
    const max = Math.max(0, ...values.map((v) => (v === null ? 0 : Math.abs(v))))
    const baseValue = base && base.totals.some((t) => t.category === category) ? totalOf(base, category) : null
    return {
      category,
      unit,
      cells: cases.map((c, i) => {
        const value = values[i]
        const isBase = c.caseId === baseId
        const delta = !isBase && value !== null && baseValue !== null ? value - baseValue : null
        return {
          caseId: c.caseId,
          value,
          delta,
          deltaPct: delta !== null && baseValue ? (delta / Math.abs(baseValue)) * 100 : null,
          relMax: value !== null && max > 0 ? (Math.abs(value) / max) * 100 : null,
        }
      }),
    }
  })
}

function groupValues(c: CaseResult, category: string, by: Grouping): Map<string, number> {
  return by === 'step'
    ? sumBy(c.byStep.filter((r) => r.category === category), (r) => r.step, (r) => r.value)
    : sumBy(c.flows.filter((r) => r.category === category), (r) => r.substance, (r) => r.value)
}

export interface ChangeRow {
  key: string
  base: number
  other: number
  delta: number
  /** The row's change as a % of the base total. */
  deltaPctOfBase: number | null
}

export interface ChangeBreakdown {
  category: string
  baseTotal: number
  otherTotal: number
  delta: number
  deltaPct: number | null
  /** Rows that changed, largest absolute change first. */
  rows: ChangeRow[]
  /** False when a side has no per-exchange detail (runs made before snapshots). */
  available: boolean
}

/** Where the difference between two cases comes from, by step or by material. */
export function changeBreakdown(base: CaseResult, other: CaseResult, category: string, by: Grouping): ChangeBreakdown {
  const baseTotal = totalOf(base, category)
  const otherTotal = totalOf(other, category)
  const available = by === 'step' || (base.flows.length > 0 && other.flows.length > 0)
  const b = groupValues(base, category, by)
  const o = groupValues(other, category, by)
  const keys = Array.from(new Set([...b.keys(), ...o.keys()]))
  const tol = Math.max(Math.abs(baseTotal), Math.abs(otherTotal), 1) * 1e-9
  const rows = keys
    .map((key) => {
      const bv = b.get(key) ?? 0
      const ov = o.get(key) ?? 0
      const delta = ov - bv
      return { key, base: bv, other: ov, delta, deltaPctOfBase: baseTotal ? (delta / Math.abs(baseTotal)) * 100 : null }
    })
    .filter((r) => Math.abs(r.delta) > tol)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
  const delta = otherTotal - baseTotal
  return {
    category,
    baseTotal,
    otherTotal,
    delta,
    deltaPct: baseTotal ? (delta / Math.abs(baseTotal)) * 100 : null,
    rows,
    available,
  }
}

export interface HotspotMatrix {
  category: string
  threshold: number
  rows: Array<{
    key: string
    cells: Array<{ caseId: string; value: number; share: number; hot: boolean }>
    /** Largest share across the cases, for sorting. */
    maxShare: number
  }>
  totals: Array<{ caseId: string; value: number }>
  available: boolean
}

/**
 * Contribution of each step or material to each case's result. A cell is hot
 * when its share of that case's total reaches the threshold (percent).
 */
export function hotspotMatrix(cases: CaseResult[], category: string, by: Grouping, threshold = 10): HotspotMatrix {
  const groups = cases.map((c) => groupValues(c, category, by))
  const totals = cases.map((c) => ({ caseId: c.caseId, value: totalOf(c, category) }))
  const keys = Array.from(new Set(groups.flatMap((g) => [...g.keys()])))
  const rows = keys
    .map((key) => {
      const cells = cases.map((c, i) => {
        const value = groups[i].get(key) ?? 0
        const total = totals[i].value
        const share = total ? (value / Math.abs(total)) * 100 : 0
        return { caseId: c.caseId, value, share, hot: share >= threshold }
      })
      return { key, cells, maxShare: Math.max(...cells.map((x) => x.share)) }
    })
    .filter((r) => r.cells.some((x) => x.value !== 0))
    .sort((a, b) => b.maxShare - a.maxShare)
  return {
    category,
    threshold,
    rows,
    totals,
    available: by === 'step' || cases.every((c) => c.flows.length > 0),
  }
}

export interface CostView {
  caseId: string
  total: number
  byKind: Record<CostKey, number>
}

export function costView(c: CaseResult): CostView {
  const byKind = Object.fromEntries(COST_KEYS.map((k) => [k, 0])) as Record<CostKey, number>
  for (const row of c.costs) for (const k of COST_KEYS) byKind[k] += row[k] > 0 ? row[k] : 0
  return { caseId: c.caseId, total: COST_KEYS.reduce((s, k) => s + byKind[k], 0), byKind }
}

export interface CostImpact {
  caseId: string
  costDelta: number
  impactDelta: number
  impactDeltaPct: number | null
  /**
   * Extra cost per unit of impact avoided (negative = the change saves money
   * too). Null unless the change lowers the impact and moves the cost.
   */
  costPerUnitAvoided: number | null
}

/** Cost against impact for one case compared with the base. */
export function costImpact(base: CaseResult, other: CaseResult, category: string): CostImpact {
  const costDelta = costView(other).total - costView(base).total
  const baseImpact = totalOf(base, category)
  const impactDelta = totalOf(other, category) - baseImpact
  const moved = Math.abs(costDelta) > 0.005
  return {
    caseId: other.caseId,
    costDelta,
    impactDelta,
    impactDeltaPct: baseImpact ? (impactDelta / Math.abs(baseImpact)) * 100 : null,
    costPerUnitAvoided: impactDelta < 0 && moved ? costDelta / -impactDelta : null,
  }
}

// ── Ranking ──────────────────────────────────────────────────────────────────

export type CompareStatus = 'ok' | 'incomplete' | 'stale'

export interface RankableCase extends CaseResult {
  /** 'incomplete': no run, no flows, or a run that computed nothing. 'stale': edited after its run. */
  status: CompareStatus
  /** LCIA method of the run compared on. */
  method: string | null
  functionalUnit?: string | null
}

/** Why a case is left out of a ranking. */
export type NotRankedReason = 'incomplete' | 'stale' | 'method' | 'functional-unit' | 'no-result'

export interface Ranking {
  category: string
  baseValue: number | null
  /** Set when the base itself cannot anchor a ranking; nothing is ranked then. */
  baseExcluded: NotRankedReason | null
  /** Rankable copies, lowest first. */
  ranked: Array<{ caseId: string; value: number; pct: number | null }>
  excluded: Array<{ caseId: string; reason: NotRankedReason }>
  /** The lowest rankable copy; `lower` when it is below the base. */
  best: { caseId: string; value: number; pct: number | null; lower: boolean } | null
}

/** A case can be read for results: it has a run that computed something. */
export function hasComparableResults(c: { run?: unknown; status?: CompareStatus }): boolean {
  return !!c.run && c.status !== 'incomplete'
}

/** The case's total in a category, or null when the run computed none. */
function rankValue(c: CaseResult, category: string): number | null {
  const rows = c.totals.filter((t) => t.category === category)
  if (!rows.length || rows.every((t) => t.flowCount === 0)) return null
  return rows.reduce((s, t) => s + t.value, 0)
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

/**
 * Rank the copies against the base in one category, lowest first. A case is
 * never ranked when it is incomplete (no run, no flows, nothing computed),
 * stale (edited after its run), computed under another LCIA method (categories
 * that share a name across methods are not the same indicator) or per another
 * functional unit.
 */
export function rankCases(cases: RankableCase[], baseId: string, category: string): Ranking {
  const base = cases.find((c) => c.caseId === baseId)
  const ownReason = (c: RankableCase): NotRankedReason | null =>
    c.status === 'incomplete'
      ? 'incomplete'
      : c.status === 'stale'
        ? 'stale'
        : rankValue(c, category) === null
          ? 'no-result'
          : null
  const empty = (baseExcluded: NotRankedReason, baseValue: number | null): Ranking => ({
    category,
    baseValue,
    baseExcluded,
    ranked: [],
    excluded: cases
      .filter((c) => c.caseId !== baseId)
      .flatMap((c) => {
        const reason = ownReason(c)
        return reason ? [{ caseId: c.caseId, reason }] : []
      }),
    best: null,
  })

  if (!base) return empty('incomplete', null)
  const baseReason = ownReason(base)
  const baseValue = rankValue(base, category)
  if (baseReason || baseValue === null) return empty(baseReason ?? 'no-result', baseValue)

  const ranked: Ranking['ranked'] = []
  const excluded: Ranking['excluded'] = []
  for (const c of cases) {
    if (c.caseId === baseId) continue
    const reason =
      ownReason(c) ??
      (norm(c.method) !== norm(base.method)
        ? 'method'
        : norm(c.functionalUnit) && norm(base.functionalUnit) && norm(c.functionalUnit) !== norm(base.functionalUnit)
          ? 'functional-unit'
          : null)
    if (reason) {
      excluded.push({ caseId: c.caseId, reason })
      continue
    }
    const value = rankValue(c, category)!
    ranked.push({ caseId: c.caseId, value, pct: pctChange(value, baseValue) })
  }
  ranked.sort((a, b) => a.value - b.value)
  const top = ranked[0]
  return {
    category,
    baseValue,
    baseExcluded: null,
    ranked,
    excluded,
    best: top ? { ...top, lower: top.value < baseValue } : null,
  }
}
