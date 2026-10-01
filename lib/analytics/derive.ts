// Derivations of the analytics page from its loaded cases: the GWP headline,
// baseline, category and component unions, chart groups, the verdict, and the
// per-component differences against the baseline. Impacts keep their sign.

import { GWP_CATEGORY_PATTERN } from './constants'
import type { AssessmentData, BarGroup, BestComparison } from './types'

/** The first climate-change (global warming) category, if the run has one. */
export function findGwpCategory<T extends { category_name: string }>(
  categories: T[],
): T | undefined {
  return categories.find((cat) => GWP_CATEGORY_PATTERN.test(cat.category_name))
}

/**
 * The headline of a case: its climate-change result, 0 when the run has none.
 * Impacts in different units cannot be added into one score (ISO 14044 4.4).
 */
export function gwpTotalScore(
  categories: { category_name: string; impact_value: number }[],
): number {
  const gwp = findGwpCategory(categories)
  return gwp ? gwp.impact_value : 0
}

/** Unit of the climate-change category, defaulting to kg CO₂-eq (also when blank). */
export function gwpUnit(categories: { category_name: string; unit: string }[]): string {
  return findGwpCategory(categories)?.unit || 'kg CO₂-eq'
}

/** Baseline: the first case with caseType "base", else the first case. */
export function pickBaseCase(assessmentData: AssessmentData[]): AssessmentData | undefined {
  return assessmentData.find((d) => d.caseType === 'base') ?? assessmentData[0]
}

/** Category names across all cases, in first-seen order. */
export function categoryNameUnion(assessmentData: AssessmentData[]): string[] {
  return Array.from(
    new Set(assessmentData.flatMap((d) => d.categories.map((c) => c.category_name)))
  )
}

/**
 * One group per category name with each case's value (0 when the case lacks
 * the category). No cases → no groups: there is no demo fallback.
 */
export function buildBarGroups(
  assessmentData: AssessmentData[],
  categoryNames: string[],
): BarGroup[] {
  // Bug fix: do NOT fall back to DEMO_CATEGORIES + fake "Baseline / Scenario
  // A / Scenario B" series. A brand-new analytics tab with no assessments
  // was rendering a fully-populated comparison chart with prototype numbers.
  // Empty arrays now drive a real empty state in the render.
  const hasRealData = assessmentData.length > 0
  return hasRealData
    ? categoryNames.map((catName) => ({
        label: catName,
        values: assessmentData.map((d) => {
          const c = d.categories.find((cc) => cc.category_name === catName)
          return c ? c.impact_value : 0
        }),
      }))
    : []
}

/** Series labels of the grouped charts: the case names, in case order. */
export function barSeriesLabels(assessmentData: AssessmentData[]): string[] {
  const hasRealData = assessmentData.length > 0
  return hasRealData
    ? assessmentData.map((d) => d.caseName)
    : []
}

/** Component names across all cases, in first-seen order. */
export function componentNameUnion(assessmentData: AssessmentData[]): string[] {
  return Array.from(
    new Set(
      assessmentData.flatMap((d) => d.components.map((c) => c.component_name))
    )
  )
}

/**
 * Verdict: the non-baseline case with the lowest GWP and its reduction vs the
 * baseline in percent (positive = lower than baseline). Null with fewer than
 * two cases or when the baseline GWP is not positive.
 */
export function findBestComparison(
  assessmentData: AssessmentData[],
  baseCase: AssessmentData | undefined,
): BestComparison | null {
  if (!baseCase || assessmentData.length < 2) return null
  const others = assessmentData.filter((d) => d !== baseCase)
  let best = others[0]
  for (const o of others) {
    if (o.totalScore < best.totalScore) best = o
  }
  if (baseCase.totalScore <= 0) return null
  const deltaPct =
    ((baseCase.totalScore - best.totalScore) / baseCase.totalScore) * 100
  return { best, deltaPct }
}

/**
 * Head-to-head card delta: the case's GWP change vs the baseline in percent
 * (negative = lower). Null for the baseline itself and when the baseline GWP
 * is not positive.
 */
export function caseCardDelta(
  c: AssessmentData,
  baseCase: AssessmentData | undefined,
): number | null {
  const isBase = c === baseCase
  const hasBase = !!baseCase && baseCase.totalScore > 0
  return !isBase && hasBase
    ? ((c.totalScore - baseCase!.totalScore) /
        baseCase!.totalScore) *
      100
    : null
}

/** Subtitle under the page title for a given number of assessed cases. */
export function analyticsSubtitle(caseCount: number): string {
  const hasRealData = caseCount > 0
  return hasRealData
    ? caseCount === 1
      ? '1 assessed case · duplicate it and change one thing to compare'
      : `Comparing ${caseCount} assessed cases`
    : 'No assessments yet · run one to populate analytics'
}

/**
 * A component's total impact in a case: the plain sum of its impacts over all
 * categories (signed). 0 when the case has no such component or no case.
 */
export function componentTotal(
  caseData: AssessmentData | undefined,
  componentName: string,
): number {
  const comp = caseData?.components.find((c) => c.component_name === componentName)
  return comp ? comp.impacts.reduce((s, i) => s + i.impact_value, 0) : 0
}

/** One cell of the component-difference table. */
export interface ComponentDiffCell {
  caseId: string
  value: number
  /** % change vs the baseline's value of the same component; null for the baseline or a zero baseline. */
  delta: number | null
}

/** One component row of the component-difference table. */
export interface ComponentDiffRow {
  name: string
  cells: ComponentDiffCell[]
}

/**
 * Component-difference rows: per component, each case's total and its % change
 * against the baseline's total, relative to the baseline's magnitude so a
 * credit baseline keeps the sign of the change.
 */
export function buildComponentDiffRows(
  assessmentData: AssessmentData[],
  componentNames: string[],
  baseCase: AssessmentData | undefined,
): ComponentDiffRow[] {
  return componentNames.map((name) => {
    const baseVal = componentTotal(baseCase, name)
    return {
      name,
      cells: assessmentData.map((d) => {
        const val = componentTotal(d, name)
        const isBase = d === baseCase
        const delta =
          !isBase && baseVal !== 0
            ? ((val - baseVal) / Math.abs(baseVal)) * 100
            : null
        return { caseId: d.caseId, value: val, delta }
      }),
    }
  })
}

/** Short case label for narrow table headers: the first word of the name. */
export function shortCaseName(caseName: string): string {
  return caseName.split(' ')[0]
}

/** Everything the page derives from its loaded cases on each render. */
export interface AnalyticsDerivations {
  baseCase: AssessmentData | undefined
  hasRealData: boolean
  barGroups: BarGroup[]
  barSeriesLabels: string[]
  allComponentNames: string[]
  bestComparison: BestComparison | null
}

/**
 * All page derivations at once. The grouped charts show the first five
 * categories. Returns new arrays on every call, like the inline code it replaces.
 */
export function deriveAnalytics(assessmentData: AssessmentData[]): AnalyticsDerivations {
  // Baseline: prefer case_type==='base', else first.
  const baseCase = pickBaseCase(assessmentData)
  // Category union (for diff table / grouped bar).
  const allCategoryNames = categoryNameUnion(assessmentData)
  // Top-5 categories for the grouped bar chart.
  const topCategoryNames = allCategoryNames.slice(0, 5)
  const hasRealData = assessmentData.length > 0
  return {
    baseCase,
    hasRealData,
    barGroups: buildBarGroups(assessmentData, topCategoryNames),
    barSeriesLabels: barSeriesLabels(assessmentData),
    // Component diff: union of component names across cases.
    allComponentNames: componentNameUnion(assessmentData),
    // Verdict — best non-baseline case (largest negative delta = most reduction).
    bestComparison: findBestComparison(assessmentData, baseCase),
  }
}
