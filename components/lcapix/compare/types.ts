// Shape of GET /api/projects/[projectId]/compare.

import type { CaseDiff, CostKey, ScopeDifference } from '@/lib/compare/diff'
import type { CaseResult, CompareStatus } from '@/lib/compare/analytics'

export interface CompareRun {
  runId: number
  method: string | null
  region: string | null
  runDate: string
  /** Why this run: picked by the user, the copies' scope, the study's scope, or the latest. */
  reason: 'picked' | 'matches-copies' | 'matches-study' | 'latest'
  /** The case was edited after this run. */
  stale: boolean
  perFuScale: number
  functionalUnit: string | null
  hasSnapshot: boolean
  /** 'snapshot': results frozen with the run; otherwise rebuilt from stored rows and current step names. */
  resultsSource: 'snapshot' | 'recomputed from current data'
  /** 'run': the step costs frozen with the run; 'current': the case's costs now. */
  costsSource: 'run' | 'current'
}

export interface CompareDataQuality {
  contributions: number
  by_tier: Record<string, number>
  gw_share_by_tier: Record<string, number>
  regional_fallbacks: number
  unit_conversions: number
  excluded_flows: number
  allocated_components: number
  uncharacterized_flows: number
  uncharacterized_examples: string[]
  category_coverage?: Array<{ category: string; covered: number; total: number; missing_examples: string[] }>
  statement: string[]
}

export interface CompareCase extends CaseResult {
  type: 'base' | 'comparative'
  isBase: boolean
  run: CompareRun | null
  /** 'incomplete' (no run, no flows, nothing computed) and 'stale' (edited after its run) are never ranked. */
  status: CompareStatus
  statusReason: string | null
  runs: Array<{ runId: number; method: string | null; region: string | null; runDate: string }>
  flows: Array<{ step: string; substance: string; category: string; value: number; tier: string | null; scope: string | null }>
  dataQuality: CompareDataQuality | null
  warnings: string[]
  costs: Array<{ step: string } & Record<CostKey, number>>
  inventory: { steps: number; flows: number }
}

export interface CompareDiff {
  caseId: string
  scope: ScopeDifference[]
  inventory: CaseDiff
}

export interface CompareResponse {
  success: boolean
  project: {
    name: string
    goal: string | null
    functionalUnit: string | null
    boundary: string | null
    method: string | null
    region: string | null
  }
  baseCaseId: string
  cases: CompareCase[]
  diffs: CompareDiff[]
}
