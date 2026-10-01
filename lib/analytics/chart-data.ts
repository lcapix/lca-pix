// Chart rows of the analytics panels. Each category row carries the plotted
// value under the series name and the raw value under `${name}__raw`, which
// the tooltips show. Values keep their sign: a credit stays below zero.

import {
  normalizeByMaxAbs,
  signedLog10,
} from '@/components/lcapix/results/analytics-impacts'
import { componentTotal } from './derive'
import type { AssessmentData, BarGroup, CategoryView } from './types'

/** A chart row keyed by series name (plus a label key such as `category` or `scenario`). */
export type ChartPoint = Record<string, number | string>

/** Opening view of the category panel: Absolute for a single scenario, else Radar. */
export function defaultCategoryView(seriesCount: number): CategoryView {
  const singleScenario = seriesCount < 2
  return singleScenario ? 'absolute' : 'radar'
}

/** Absolute view: raw impact values per category and series. */
export function buildAbsoluteChartData(
  groups: BarGroup[],
  seriesLabels: string[],
): ChartPoint[] {
  return groups.map((g) => {
    const point: ChartPoint = { category: g.label }
    seriesLabels.forEach((name, i) => {
      point[name] = g.values[i]
      point[`${name}__raw`] = g.values[i]
    })
    return point
  })
}

/** Normalised view: each value as a percent of the category's largest magnitude. */
export function buildNormalizedChartData(
  groups: BarGroup[],
  seriesLabels: string[],
): ChartPoint[] {
  return groups.map((g) => {
    // Percent of the largest magnitude: a credit stays below zero.
    const pct = normalizeByMaxAbs(g.values)
    const point: ChartPoint = { category: g.label }
    seriesLabels.forEach((name, i) => {
      point[name] = pct[i]
      point[`${name}__raw`] = g.values[i]
    })
    return point
  })
}

/**
 * Radar view: each category normalised to its max across scenarios so the
 * shape reads at a glance (otherwise one giant category dwarfs the rest).
 * Same numbers as the normalised view.
 */
export function buildRadarChartData(
  groups: BarGroup[],
  seriesLabels: string[],
): ChartPoint[] {
  return buildNormalizedChartData(groups, seriesLabels)
}

/** Log view: signed log10(|v| + 1) per value, so a credit is not flattened to 0. */
export function buildLogChartData(
  groups: BarGroup[],
  seriesLabels: string[],
): ChartPoint[] {
  return groups.map((g) => {
    const point: ChartPoint = { category: g.label }
    seriesLabels.forEach((name, i) => {
      const v = g.values[i]
      point[name] = signedLog10(v)
      point[`${name}__raw`] = v
    })
    return point
  })
}

/** Y-axis tick of the log view, e.g. 2 → "10^2.0", -1.5 → "-10^1.5". */
export function formatLogTick(v: number): string {
  return `${v < 0 ? '-' : ''}10^${Math.abs(v).toFixed(1)}`
}

/**
 * Delta view: per category, each non-baseline series' % change vs the baseline
 * series (index `baseIndex`), relative to the baseline's magnitude so a credit
 * baseline keeps the sign of the change. Missing or NaN values read as 0; a
 * zero baseline gives 0. `others` are the non-baseline series, in order after
 * the baseline.
 */
export function buildDeltaChartData(
  groups: BarGroup[],
  others: string[],
  baseIndex = 0,
): ChartPoint[] {
  return groups.map((g) => {
    const base = g.values[baseIndex] || 0
    const point: ChartPoint = { category: g.label }
    others.forEach((name, i) => {
      const v = g.values[i + 1] || 0
      point[name] = base !== 0 ? ((v - base) / Math.abs(base)) * 100 : 0
    })
    return point
  })
}

/** Signed percent label, e.g. 12.34 → "+12.3%" (1 digit), -5 → "-5%" (0 digits), 0 → "0%". */
export function formatSignedPercent(v: number, digits: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`
}

/**
 * Component-contribution rows: one per scenario, each component's total impact
 * (summed over categories, signed) under its name; 0 when the case lacks it.
 */
export function buildComponentBreakdownRows(
  assessmentData: AssessmentData[],
  allComponentNames: string[],
): ChartPoint[] {
  return assessmentData.map((d) => {
    const point: ChartPoint = { scenario: d.caseName }
    allComponentNames.forEach((name) => {
      point[name] = componentTotal(d, name)
    })
    return point
  })
}
