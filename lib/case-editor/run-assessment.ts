// Run Assessment from the case editor: when a run is allowed, what it sends,
// what it reports, and what the case's past runs say.

import type { CompletenessReport } from './types'

// A case can be assessed only if it has at least one impact-bearing flow
// layer (materials / energy / emissions / transport). Skeleton + costs alone
// characterize to nothing, so a run would return a misleading 0. This is the
// honest gate; tightening it to require specific layers (e.g. block until
// energy is present too) is a product decision — change IMPACT_LAYERS.
export const IMPACT_LAYERS = ['materials', 'energy', 'emissions', 'transport']

/** True until the completeness report says there is nothing to characterize. */
export function isInventoryReady(completeness: CompletenessReport | null): boolean {
  return !completeness || completeness.present.some((l) => IMPACT_LAYERS.includes(l))
}

/** The toast when Run Assessment is clicked but the case cannot run. */
export function runBlockedMessage(fuMissing: boolean): string {
  return fuMissing
    ? 'Set the functional unit first (Goal & scope), so the result is per something.'
    : 'Nothing to assess yet — add at least one input or emission (materials, energy, or a direct output). A case with no flows would return 0.'
}

/** The Run Assessment button's tooltip. */
export function runButtonTitle(fuMissing: boolean, canRun: boolean): string | undefined {
  return fuMissing
    ? 'Set the functional unit (Goal & scope) before running'
    : !canRun
      ? 'Add at least one input or emission before running'
      : undefined
}

export type RunPrefs = { method?: string; region?: string }

/**
 * The method/region the run modal remembered for this case. A quick-run that
 * silently switched a US case back to Global made the latest run
 * non-comparable with its own history. Nothing (or something corrupt)
 * remembered: {} and the server uses the study's scope.
 */
export function readRunPrefs(caseId: string, storage?: Pick<Storage, 'getItem'>): RunPrefs {
  try {
    return JSON.parse((storage ?? localStorage).getItem(`lcapix-run-prefs:${caseId}`) || '{}')
  } catch {
    /* corrupt prefs are ignorable */
    return {}
  }
}

/** Body of POST /api/cases/:id/assessments for a quick run. */
export function buildRunBody(remembered: RunPrefs) {
  return {
    run_name: 'Assessment',
    ...(remembered.method ? { calculation_method: remembered.method } : {}),
    ...(remembered.region ? { region_code: remembered.region } : {}),
  }
}

/** The success toast: the global-warming total when the response has one. */
export function assessmentCompleteMessage(data: any): string {
  const total = data?.total_impacts?.find?.(
    (t: any) => /global warming/i.test(t.category_name),
  )?.impact_value
  return typeof total === 'number'
    ? `Assessment complete — ${total.toFixed(3)} kg CO₂-eq`
    : 'Assessment complete'
}

/**
 * The runs of GET /api/cases/:id/assessments that count as an assessment. A
 * run that produced no results (nothing to characterize) does not count.
 */
export function completedRuns(assessments: any[] | undefined): any[] {
  return (assessments ?? []).filter(
    (a: any) =>
      (!a.status || a.status === 'completed') && Object.keys(a.impacts ?? {}).length > 0,
  )
}

/**
 * Which step carried the most climate impact in a run (the newest one, for
 * the reveal after a prediction): its name, null when no step has any, or
 * undefined when the run has no climate category (keep the previous answer).
 */
export function topClimateStep(run: any): string | null | undefined {
  const climateKey = Object.keys(run?.impacts ?? {}).find((k) =>
    /global warming|climate/i.test(k),
  )
  if (!run || !climateKey) return undefined
  const ranked = (run.components ?? [])
    .map((c: any) => ({ name: c.component_name, v: Number(c.impacts?.[climateKey] ?? 0) }))
    .filter((c: any) => c.v > 0)
    .sort((a: any, b: any) => b.v - a.v)
  return ranked[0]?.name ?? null
}

/** True when a sibling case has been run: what makes lesson 5 (compare) possible. */
export function hasRunSibling(cases: any[] | undefined, caseId: string): boolean {
  const others = (cases ?? []).filter(
    (c: any) => String(c.case_id) !== String(caseId) && Number(c.run_count ?? 0) > 0,
  )
  return others.length > 0
}
