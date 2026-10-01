// Pure helpers behind the results screen (/project/[id]/case/[caseId]/results):
// the category list, the flow table rows and their provenance, the run
// history, the stage panel input and the header/hero labels.

import type { CategoryBarChartItem } from '@/components/lcapix/results/category-bar-chart'
import type { RunTimelineRun, RunTimelineStatus } from '@/components/lcapix/results/run-timeline'
import type { AssessmentResult, FilterDir } from './assessment'

export type { APIComponentBreakdown, AssessmentResult, FilterDir, FlowDetailRow } from './assessment'

/** Impact categories supported (preserved for unit lookup when a case has no run). */
export const IMPACT_CATEGORIES: Record<string, { unit: string }> = {
  'Global warming': { unit: 'kg CO₂-eq' },
  'Ozone depletion': { unit: 'kg CFC-11-eq' },
  'Smog formation': { unit: 'kg NOₓ-eq' },
  'Freshwater ecotoxicity': { unit: 'CTUe' },
  Acidification: { unit: 'kg SO₂-eq' },
}

/** Provenance tier of a factor, as shown on hover in the flow table. */
export const TIER_LABEL: Record<string, string> = {
  authoritative: 'authoritative published source',
  industry_average: 'industry average',
  unverified: 'unverified legacy value',
  unknown: 'no source recorded',
}

/**
 * The category chips / list: the run's categories with their coverage when
 * partial, else the canonical IMPACT_CATEGORIES at zero.
 */
export function buildCategoryItems(run: AssessmentResult | null | undefined): CategoryBarChartItem[] {
  const impactEntries: Array<[string, { value: number; unit: string }]> = run ? Object.entries(run.impacts) : []
  const coverageByCategory = new Map(
    (run?.dataQuality?.category_coverage ?? []).map((c) => [c.category, c]),
  )
  return impactEntries.length
    ? impactEntries.map(([name, imp]) => {
        const cov = coverageByCategory.get(name)
        return {
          key: name,
          label: name,
          value: imp.value,
          unit: imp.unit,
          coverage:
            cov && cov.covered < cov.total
              ? { covered: cov.covered, total: cov.total, missing: cov.missing_examples }
              : undefined,
        }
      })
    : Object.entries(IMPACT_CATEGORIES).map(([name, info]) => ({
        key: name,
        label: name,
        value: 0,
        unit: info.unit,
      }))
}

/** The category selected by default: the global-warming-ish one, else the first. */
export function primaryCategoryKey(items: CategoryBarChartItem[]): string {
  return (
    items.find((c) => /global\s*warming|carbon|co2/i.test(c.key))?.key ||
    items[0]?.key ||
    ''
  )
}

/** One row of the flow-level detail table. */
export interface FlowTableRow {
  id: string
  component: string
  substance: string
  dir: 'IN' | 'OUT'
  amount: number
  unit: string
  factor: number
  impact: number
  scope?: string
  conversion?: string | null
  sourceTier: string | null
  source: string | null
  allocation: number | null
}

/**
 * The flow table: the run's per-flow rows for the active category (computed
 * server-side: Amount × Factor = Impact), filtered by direction.
 */
export function flowTableRows(
  run: AssessmentResult | null | undefined,
  activeCat: { key: string } | null | undefined,
  filter: FilterDir,
): FlowTableRow[] {
  return (run?.flowDetail || [])
    .filter((f) => !activeCat || f.category_name === activeCat.key)
    .filter((f) =>
      filter === 'all'
        ? true
        : filter === 'in'
          ? f.dir === 'IN'
          : f.dir === 'OUT',
    )
    .map((f) => ({
      id: String(f.flow_id),
      component: f.component,
      substance: f.substance,
      dir: f.dir,
      amount: f.amount,
      unit: f.unit,
      factor: f.factor,
      impact: f.impact,
      scope: f.scope,
      conversion: f.conversion,
      sourceTier: f.source_tier ?? null,
      source: f.source ?? null,
      allocation: f.allocation ?? null,
    }))
}

/** The factor cell's hover text: its source and provenance tier. */
export function factorTitle(source: string | null, sourceTier: string | null): string | undefined {
  return source
    ? `Source: ${source}${sourceTier ? ` (${TIER_LABEL[sourceTier] ?? sourceTier})` : ''}`
    : sourceTier
      ? TIER_LABEL[sourceTier]
      : undefined
}

/** A factor with no recorded or only a legacy source gets a warning mark. */
export function isWeakFactorSource(sourceTier: string | null): boolean {
  return sourceTier === 'unverified' || sourceTier === 'unknown'
}

/** The engine fell back to the Global factor although the run was for another region. */
export function isGlobalFallback(scope: string | undefined, runRegion: string): boolean {
  return scope === 'Global' && runRegion !== 'Global'
}

/**
 * The historical-runs timeline for one category: every run that has a value
 * for it, oldest first, labelled by date ("recent" when unparseable).
 */
export function historyTimelineRuns(
  runs: AssessmentResult[],
  activeCat: { key: string } | null | undefined,
): RunTimelineRun[] {
  return activeCat
    ? runs
        .filter((r) => typeof r.impacts?.[activeCat.key]?.value === 'number')
        .map((r) => {
          const d = new Date(r.run_date)
          return {
            id: r.run_id,
            timestamp: isNaN(d.getTime())
              ? 'recent'
              : d.toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                }),
            totalImpact: r.impacts[activeCat.key].value,
            status:
              (r.status === 'completed' || r.status === 'success'
                ? 'success'
                : r.status === 'partial'
                  ? 'partial'
                  : 'error') as RunTimelineStatus,
          }
        })
        .reverse()
    : []
}

/** "last run" in the hero: the run's local date-time, 'Recent' if unparseable, 'Never' without a run. */
export function lastRunLabel(run: { run_date: string } | null | undefined): string {
  return run
    ? isNaN(new Date(run.run_date).getTime())
      ? 'Recent'
      : new Date(run.run_date).toLocaleString()
    : 'Never'
}

/** The header's run date ("Sep 30, 2:05 PM"), 'Recent' when missing or unparseable. */
export function safeRunDate(raw?: string | null): string {
  if (!raw) return 'Recent'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return 'Recent'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * The life-cycle stage panel's input: the run's headline category (global
 * warming, else the first) and each step's value in it. Null without impacts.
 */
export function stagePanelInput(run: AssessmentResult): {
  categoryName: string
  unit: string
  rows: Array<{ component_name: string; life_cycle_stage: string | null; value: number; flows: number }>
} | null {
  const headline =
    Object.entries(run.impacts).find(([k]) => /global warming|climate/i.test(k)) ??
    Object.entries(run.impacts)[0]
  if (!headline) return null
  const [categoryName, headlineValue] = headline
  const rows = (run.componentBreakdown ?? []).map((c) => ({
    component_name: c.component_name,
    life_cycle_stage: c.life_cycle_stage ?? null,
    value:
      Number(
        (c.impacts ?? []).find((i) => i.category_name === categoryName)?.impact_value ?? 0,
      ) || 0,
    flows: Number(c.flows_processed ?? 0),
  }))
  return { categoryName, unit: headlineValue?.unit ?? '', rows }
}

/** The downloaded export's file name. */
export function exportFileName(
  format: 'pdf' | 'pptx' | 'csv',
  caseName: string | undefined,
  runId: number,
): string {
  const stem = format === 'csv' ? 'LCAPIX_inventory' : 'LCAPIX_Report'
  return `${stem}_${caseName?.replace(/[^a-zA-Z0-9]/g, '_') ?? runId}.${format}`
}
