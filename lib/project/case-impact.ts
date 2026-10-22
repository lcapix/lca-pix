// Pure helpers behind the project workspace's right rail (Impact Overview,
// Top contributors, Cost summary): which runs count, the focal category of a
// run and who contributes to it.

/** The per-case cost summary (lib/case-tree-adapter summarizeCaseCosts). */
export interface CaseCosts {
  labor: number
  energy: number
  material: number
  overhead: number
  total: number
}

/** What the workspace knows about the active case's latest run. */
export interface CaseImpact {
  totalImpact: number | null
  unit: string
  /** Full per-component impact map (focal category) for tree roll-up. */
  impactByComponent: Record<string, number>
  contributors: Array<{ name: string; value: number; pct: number }>
  costs: CaseCosts | null
  /** Method of the latest run, and how many categories it reported. */
  method?: string | null
  categoryCount?: number
}

/** One row of /api/assessments/:runId `results`. */
export interface RunResultRow {
  category_name?: unknown
  unit?: string | null
  impact_value?: unknown
  component_name?: string | null
  component_id?: unknown
}

/** The unit shown when a run (or no run) names none. */
export const DEFAULT_IMPACT_UNIT = 'kg CO₂-eq'

/** Runs that finished; older rows carry no status at all. */
export function completedAssessments<T extends { status?: unknown }>(assessments: T[]): T[] {
  return assessments.filter((a) => !a.status || a.status === 'completed')
}

/**
 * The focal category of a run (global warming, else the first category) and
 * its top five contributors. Never a sum across categories: they are in
 * different units (and the name is "Global Warming" in the data).
 */
export function summarizeRunResults(results: RunResultRow[]): {
  total: number
  unit: string
  contributors: Array<{ name: string; value: number; pct: number }>
  impactByComponent: Record<string, number>
  categoryCount: number
} {
  const gw = results.filter((r) => /global warming|climate/i.test(String(r.category_name)))
  const firstCat = results[0]?.category_name
  const focal = gw.length ? gw : results.filter((r) => r.category_name === firstCat)
  const unit = focal[0]?.unit || DEFAULT_IMPACT_UNIT
  const total = focal.reduce((s, r) => s + Number(r.impact_value || 0), 0)
  // Aggregate per-component for top contributors (within focal category).
  const byComp = new Map<string, number>()
  for (const r of focal) {
    byComp.set(
      r.component_name || `#${r.component_id}`,
      (byComp.get(r.component_name || `#${r.component_id}`) || 0) + Number(r.impact_value || 0),
    )
  }
  const contributors = [...byComp.entries()]
    .map(([name, value]) => ({
      name,
      value,
      pct: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
  return {
    total,
    unit,
    contributors,
    impactByComponent: Object.fromEntries(byComp),
    categoryCount: new Set(results.map((r) => r.category_name)).size,
  }
}
