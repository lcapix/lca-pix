// Pure derivations for the project workspace (/project/[projectId]): which
// case is active, the KPI strip, the right-rail numbers and the run request.

import { DEFAULT_IMPACT_UNIT, type CaseImpact } from './case-impact'

/** A case as the workspace holds it (lib/data-transformers transformCaseFromDB). */
export type WorkspaceCase = any

/** The case selected when a project loads: the base case, else the first. */
export function defaultActiveCaseId(cases: WorkspaceCase[]): string | null {
  if (cases.length === 0) return null
  const baseCase = cases.find((c: any) => c.type === 'base')
  const firstCase = baseCase || cases[0]
  return firstCase.id
}

/** Where "Add Case" goes: the base case first, comparatives after it. */
export function addCasePath(projectId: string, baseCaseCount: number): string {
  return baseCaseCount === 0
    ? `/project/${projectId}/case/base/new`
    : `/project/${projectId}/case/comparative/new`
}

/** One tile of the KPI strip under the project header. */
export interface WorkspaceKpi {
  label: string
  value: string
  note: string
  tone?: 'brand' | 'neutral'
}

/** Everything the workspace renders that is derived from the loaded data. */
export interface WorkspaceView {
  cases: WorkspaceCase[]
  baseCases: WorkspaceCase[]
  comparativeCases: WorkspaceCase[]
  activeCase: WorkspaceCase | null
  /** 'comparative' when the project has comparative cases. */
  projectTypeLabel: 'comparative' | 'base'
  assessed: boolean
  totalImpact: number | null
  impactUnit: string
  componentCount: number
  driverCount: number
  totalCost: number | null
  contributors: Array<{ name: string; value: number; pct: number }>
  /** The comparison banner shows with two cases or more. */
  showComparisonBanner: boolean
  kpis: WorkspaceKpi[]
}

/** The KPI strip: honest empty states (a "0" with a nudge), never a made-up number. */
export function workspaceKpis(args: {
  caseCount: number
  baseCount: number
  comparativeCount: number
  componentCount: number
  driverCount: number
  totalImpact: number | null
  impactUnit: string
  totalCost: number | null
}): WorkspaceKpi[] {
  const { caseCount, baseCount, comparativeCount, componentCount, driverCount, totalImpact, impactUnit, totalCost } =
    args
  return [
    {
      label: 'Cases',
      value: String(caseCount),
      note:
        caseCount === 0
          ? 'Import your routing to create the first case'
          : `${baseCount} base · ${comparativeCount} comparative`,
      tone: caseCount > 0 ? 'brand' : 'neutral',
    },
    {
      label: 'Steps',
      value: String(componentCount),
      note:
        componentCount === 0
          ? 'The routing builds them'
          : `${driverCount} input/output flow${driverCount === 1 ? '' : 's'}`,
      tone: componentCount > 0 ? 'brand' : 'neutral',
    },
    {
      label: 'Global Warming',
      value: totalImpact != null ? totalImpact.toFixed(3) : '—',
      note: totalImpact != null ? impactUnit : 'Run an assessment',
      tone: totalImpact != null ? 'brand' : 'neutral',
    },
    {
      label: 'Cost',
      value: totalCost != null ? `$${Math.round(totalCost).toLocaleString()}` : '—',
      note: totalCost != null ? 'Total ABC cost' : 'Add cost data on operations',
      tone: totalCost != null ? 'brand' : 'neutral',
    },
  ]
}

/** Derives the workspace view from the project, the active case id and the case's latest run. */
export function workspaceView(
  project: { cases?: WorkspaceCase[] },
  activeCaseId: string | null,
  caseImpact: CaseImpact | null,
): WorkspaceView {
  const cases: any[] = project.cases || []
  const baseCases = cases.filter((c) => c.type === 'base')
  const comparativeCases = cases.filter((c) => c.type === 'comparative')
  const activeCase = cases.find((c) => c.id === activeCaseId) || cases[0] || null
  // Project type chip: BASE when only base cases, COMP when comparatives present
  const projectTypeLabel = comparativeCases.length > 0 ? 'comparative' : 'base'

  const assessed =
    Boolean(activeCase?.assessmentRunAt || activeCase?.assessed) ||
    (caseImpact?.totalImpact != null && caseImpact.totalImpact > 0)
  const totalImpact = caseImpact?.totalImpact ?? null
  const impactUnit = caseImpact?.unit ?? DEFAULT_IMPACT_UNIT
  const componentCount = activeCase?.componentCount ?? activeCase?.components?.length ?? 0
  const driverCount = activeCase?.driverCount ?? 0
  // Real per-case cost from the component cost columns; null when there is none.
  const totalCost = caseImpact?.costs?.total ?? null
  // Never demo contributors: no run means an empty list, and the panel shows
  // a real empty state.
  const contributors =
    caseImpact && caseImpact.contributors.length > 0
      ? caseImpact.contributors.map((c) => ({
          name: c.name,
          value: c.value,
          pct: c.pct,
        }))
      : []

  return {
    cases,
    baseCases,
    comparativeCases,
    activeCase,
    projectTypeLabel,
    assessed,
    totalImpact,
    impactUnit,
    componentCount,
    driverCount,
    totalCost,
    contributors,
    // Optional comparison delta (visible only with ≥ 2 cases)
    showComparisonBanner: cases.length >= 2,
    kpis: workspaceKpis({
      caseCount: cases.length,
      baseCount: baseCases.length,
      comparativeCount: comparativeCases.length,
      componentCount,
      driverCount,
      totalImpact,
      impactUnit,
      totalCost,
    }),
  }
}

/**
 * Method and region remembered for a case (`lcapix-run-prefs:<caseId>`, the
 * same per-case memory as the case page and the run modal). Unreadable or
 * corrupt prefs read as none.
 */
export function readRunPrefs(
  getItem: (key: string) => string | null,
  caseId: string,
): { method?: string; region?: string } {
  let remembered: { method?: string; region?: string } = {}
  try {
    remembered = JSON.parse(getItem(`lcapix-run-prefs:${caseId}`) || '{}')
  } catch {
    /* corrupt prefs are ignorable */
  }
  return remembered
}

/**
 * The POST /api/cases/:id/assessments body for a run started from the
 * workspace. Method and region are omitted when never chosen: the server then
 * uses the study's method (project) and the case's region.
 */
export function runAssessmentBody(
  caseName: string,
  remembered: { method?: string; region?: string },
): Record<string, string> {
  return {
    run_name: `${caseName} run`,
    ...(remembered.method ? { calculation_method: remembered.method } : {}),
    ...(remembered.region ? { region_code: remembered.region } : {}),
  }
}
