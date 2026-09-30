// Pure helpers behind the results screen: which run is shown, how it compares
// with the one before, who contributes, and what a re-run starts from.

export interface RunLike {
  run_id: number
  status?: string | null
  calculation_method?: string | null
  /** Canonical region code the run used ('US', 'EU', 'Global', …). */
  regionCode?: string | null
  impacts?: Record<string, { value: number; unit?: string }>
}

/** A run that finished (older rows have no status). */
export function isCompletedRun(r: { status?: string | null }): boolean {
  return !r.status || r.status === 'completed'
}

/** The newest run that completed; `runs` is newest first. */
export function latestCompletedRun<T extends { status?: string | null }>(runs: T[]): T | null {
  return runs.find(isCompletedRun) ?? null
}

/**
 * Change of one category's total, in percent, from the previous run with the
 * same method and region to the latest completed run (RES-2). Runs under
 * another method or region are not comparable and are skipped. The change is
 * measured against the size of the previous value, so a shrinking credit reads
 * as an increase. Null when there is no comparable previous run or it is 0.
 */
export function deltaVsPreviousRun(runs: RunLike[], categoryKey: string): number | null {
  const valueOf = (r: RunLike) => {
    const v = r.impacts?.[categoryKey]?.value
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  const done = runs.filter((r) => isCompletedRun(r) && valueOf(r) !== null)
  const [latest, ...older] = done
  if (!latest) return null
  const sameScope = (r: RunLike) =>
    (r.calculation_method ?? '') === (latest.calculation_method ?? '') &&
    (r.regionCode ?? '') === (latest.regionCode ?? '')
  const previous = older.find(sameScope)
  if (!previous) return null
  const prev = valueOf(previous)!
  if (prev === 0) return null
  return ((valueOf(latest)! - prev) / Math.abs(prev)) * 100
}

export interface Contributor {
  id: string
  name: string
  value: number
  /** Share of the sum of absolute step values, in percent. */
  pct: number
}

/**
 * The steps carrying a category, largest first (RES-4). Credits (negative
 * values) stay in: they are part of the result. Each share is the step's size
 * over the sum of absolute step values, so a credit shows how much it moves the
 * total rather than disappearing.
 */
export function rankContributors(
  breakdown: Array<{
    component_id: number | string | null
    component_name: string
    impacts?: Array<{ category_name: string; impact_value: number | string }>
  }>,
  categoryKey: string,
  limit = 5,
): Contributor[] {
  const rows = breakdown
    .map((c) => ({
      id: String(c.component_id),
      name: c.component_name,
      value: Number((c.impacts ?? []).find((i) => i.category_name === categoryKey)?.impact_value ?? 0) || 0,
    }))
    .filter((c) => c.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  const absSum = rows.reduce((s, c) => s + Math.abs(c.value), 0)
  return rows.slice(0, limit).map((c) => ({ ...c, pct: absSum > 0 ? (Math.abs(c.value) / absSum) * 100 : 0 }))
}

/** Canonical region code to the label the pickers use. */
export function regionToPicker(rc: string): string {
  return rc === 'US' ? 'US Grid' : rc === 'EU' ? 'EU Average' : rc
}

/**
 * What a new run starts from (RUN-5): the displayed run's method and region,
 * else the study's method and the case's region, then the project's. Unknown
 * values stay undefined, so the run modal applies its own lookup (the case's
 * last-used settings, then the study scope) instead of a hard-coded US grid.
 */
export function initialRunScope(input: {
  latestRun?: { calculation_method?: string | null; regionCode?: string | null } | null
  caseRegion?: string | null
  projectRegion?: string | null
  studyMethod?: string | null
}): { method?: string; region?: string } {
  const method = input.latestRun?.calculation_method || input.studyMethod || undefined
  const rc = input.latestRun?.regionCode || input.caseRegion || input.projectRegion || undefined
  return { method, region: rc ? regionToPicker(rc) : undefined }
}
