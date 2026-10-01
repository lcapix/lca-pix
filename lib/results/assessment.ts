// The shape of an assessment run as the results screen holds it, and how it
// is built from the API: a GET /api/cases/:id/assessments row or the POST
// answer the run modal hands back.

import type { GoalScope } from '@/lib/run-snapshot'
import type { DataQualitySummary } from '@/lib/lca-engine'

/** One step of a run's component breakdown (API shape). */
export interface APIComponentBreakdown {
  component_id: number
  component_name: string
  component_type: string
  /** Life-cycle stage of the step (migrate-022); null reads as production. */
  life_cycle_stage?: string | null
  flows_processed: number
  impacts: Array<{
    category_id: number
    category_name: string
    impact_value: number
    unit: string
  }>
}

/** One row of a run's per-flow detail (API shape). */
export interface FlowDetailRow {
  flow_id: number
  component: string
  substance: string
  category_name: string
  dir: 'IN' | 'OUT'
  amount: number
  unit: string
  factor: number
  impact: number
  /** Factor scope the engine selected ('US', 'Global', ...) — snapshot runs only. */
  scope?: string
  /** Unit conversion the engine applied (e.g. "1 g = 0.001 kg") — snapshot runs only. */
  conversion?: string | null
  /** Provenance tier of the factor (authoritative / industry_average / unverified / unknown). */
  source_tier?: string | null
  /** The factor's cited source. */
  source?: string | null
  /** Allocation share applied to this row, when < 1. */
  allocation?: number | null
}

/** A run as the results screen holds it. */
export interface AssessmentResult {
  run_id: number
  run_name: string
  calculation_method: string
  status: string
  run_date: string
  executed_by_username: string
  impacts: Record<string, { value: number; unit: string }>
  costs: { operational: number; capital: number; total: number }
  componentBreakdown: APIComponentBreakdown[]
  flowDetail: FlowDetailRow[]
  algorithmSteps?: string[]
  /** Engine data-quality warnings frozen in the run snapshot. */
  warnings?: string[]
  /** Region the run was computed with (canonical code, e.g. 'US'). */
  regionCode?: string
  /** Goal & scope frozen with the run (ISO 14044 4.2); null for older runs. */
  goalScope?: GoalScope | null
  /** Data-quality statement frozen with the run (ISO 14044 4.2.3.6). */
  dataQuality?: DataQualitySummary | null
}

/** The flow table's input/output filter. */
export type FilterDir = 'all' | 'in' | 'out'

/** A run from GET /api/cases/:id/assessments, as the screen holds it. */
export function toAssessmentResult(assessment: any): AssessmentResult {
  return {
    run_id: assessment.run_id,
    run_name: assessment.run_name,
    calculation_method: assessment.calculation_method,
    status: assessment.status,
    run_date: assessment.run_date,
    executed_by_username: assessment.executed_by_username,
    impacts: assessment.impacts || {},
    costs: assessment.costs || {
      operational: 0,
      capital: 0,
      total: 0,
    },
    componentBreakdown: assessment.componentBreakdown || [],
    flowDetail: assessment.flowDetail || [],
    warnings: assessment.warnings || [],
    regionCode: assessment.region_code ?? undefined,
    goalScope: assessment.goal_scope ?? null,
    dataQuality: assessment.data_quality ?? null,
  }
}

/**
 * A run from the POST /api/cases/:id/assessments answer (the run modal's
 * onCompleted). Costs come from the case's components that carry drivers.
 */
export function buildAssessmentResult(
  data: any,
  components: Array<{ driverCategory?: unknown; drivers?: unknown[]; operationalCostUSD?: number; capitalCostUSD?: number }> | undefined,
): AssessmentResult {
  const impacts: Record<string, { value: number; unit: string }> = {}
  if (data.total_impacts) {
    data.total_impacts.forEach((impact: any) => {
      impacts[impact.category_name] = {
        value: impact.impact_value,
        unit: impact.unit,
      }
    })
  }

  const componentsWithDrivers =
    components?.filter(
      (c) => c.driverCategory && c.drivers && c.drivers.length > 0,
    ) || []
  const totalOperationalCost = componentsWithDrivers.reduce(
    (sum, c) => sum + (c.operationalCostUSD || 0),
    0,
  )
  const totalCapitalCost = componentsWithDrivers.reduce(
    (sum, c) => sum + (c.capitalCostUSD || 0),
    0,
  )

  return {
    run_id: data.assessment.run_id,
    run_name: data.assessment.run_name,
    calculation_method: data.assessment.calculation_method,
    status: data.assessment.status,
    run_date: data.assessment.run_date,
    executed_by_username: data.assessment.executed_by_username,
    impacts,
    costs: {
      operational: totalOperationalCost,
      capital: totalCapitalCost,
      total: totalOperationalCost + totalCapitalCost,
    },
    componentBreakdown: data.component_breakdown || [],
    flowDetail: data.flowDetail || [],
    warnings: data.warnings || [],
    algorithmSteps: data.algorithm_steps || [],
    regionCode: data.assessment?.region_code ?? undefined,
    goalScope: data.goal_scope ?? null,
    dataQuality: data.data_quality ?? null,
  }
}
