// Shapes the analytics page works with: one entry per assessed case, built from
// the case's latest completed run plus the cost columns of its components.

/** Per-case cost totals, summed over the case's components. */
export interface CostBreakdown {
  /** Sum of all per-component costs (labor+energy+material+transport, or opex+capex). */
  total: number
  labor: number
  energy: number
  material: number
  transport: number
  equipment: number
  overhead: number
  opex: number
  capex: number
  currency: string
}

/** One category total of a run. Signed: a net credit is negative. */
export interface AnalyticsCategory {
  category_name: string
  impact_value: number
  unit: string
}

/** One component of a run with its signed per-category impacts. */
export interface AnalyticsComponent {
  component_name: string
  component_type: string
  impacts: {
    category_name: string
    impact_value: number
  }[]
}

/** One assessed case as the analytics page renders it. */
export interface AssessmentData {
  caseId: string
  caseName: string
  caseType: string
  categories: AnalyticsCategory[]
  components: AnalyticsComponent[]
  /** Climate-change (GWP) result of the latest run; 0 when the run has none. */
  totalScore: number
  costs: CostBreakdown
}

/** One category of the grouped charts: a value per series (case), in series order. */
export interface BarGroup {
  label: string
  values: number[]
}

/** The views of the "Impact by category" panel. */
export type CategoryView = 'radar' | 'normalized' | 'log' | 'absolute'

/** The best non-baseline case and its GWP reduction vs the baseline, in percent. */
export interface BestComparison {
  best: AssessmentData
  deltaPct: number
}
