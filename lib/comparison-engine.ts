/**
 * LCA Comparison Engine
 * Compares environmental impacts across multiple cases
 */

import { Connection, RowDataPacket } from 'mysql2/promise'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CaseImpact {
  case_id: number
  case_name: string
  case_description?: string
  run_id: number
  total_impacts: CategoryImpact[]
  component_breakdown: ComponentImpact[]
}

export interface CategoryImpact {
  category_id: number
  category_name: string
  impact_value: number
  unit: string
  flow_count: number
}

export interface ComponentImpact {
  component_id: number
  component_name: string
  component_type: string
  impacts: CategoryImpact[]
}

export interface CategoryComparison {
  category_id: number
  category_name: string
  unit: string
  values: CaseValue[]
  best_case_id: number
  worst_case_id: number
  variance: number  // Statistical variance
}

export interface CaseValue {
  case_id: number
  case_name: string
  absolute_value: number
  delta_from_base: number
  delta_percentage: number
  rank: number  // 1 = best (lowest impact)
}

export interface OverallRanking {
  case_id: number
  case_name: string
  total_score: number  // Sum of all impacts
  normalized_score: number  // Normalized to 0-100
  rank: number
  wins: number  // Number of categories where this case is best
  losses: number  // Number of categories where this case is worst
}

export interface ComparisonResult {
  comparison_id?: number
  comparison_name: string
  base_case_id: number
  cases: CaseImpact[]
  category_comparisons: CategoryComparison[]
  overall_rankings: OverallRanking[]
  summary: {
    total_cases_compared: number
    total_categories_analyzed: number
    overall_best_case_id: number
    overall_worst_case_id: number
  }
}

// ============================================================================
// COMPARISON ENGINE FUNCTIONS
// ============================================================================

/**
 * Compare multiple cases and generate comprehensive comparison
 */
export async function compareCases(
  connection: Connection,
  caseIds: number[],
  comparisonName: string
): Promise<ComparisonResult> {
  const startTime = Date.now()

  // Validate input
  if (caseIds.length < 2) {
    throw new Error('At least 2 cases required for comparison')
  }
  if (caseIds.length > 10) {
    throw new Error('Maximum 10 cases can be compared at once')
  }

  // Fetch latest assessment for each case
  const cases: CaseImpact[] = []
  for (const caseId of caseIds) {
    const caseData = await fetchCaseAssessment(connection, caseId)
    if (!caseData) {
      throw new Error(`No assessment found for case ${caseId}`)
    }
    cases.push(caseData)
  }

  // Base case is the first one
  const baseCaseId = caseIds[0]

  // Compare by category
  const categoryComparisons = compareByCategory(cases, baseCaseId)

  // Calculate overall rankings
  const overallRankings = calculateOverallRankings(cases, categoryComparisons)

  // Calculate summary
  const summary = {
    total_cases_compared: cases.length,
    total_categories_analyzed: categoryComparisons.length,
    overall_best_case_id: overallRankings[0].case_id,
    overall_worst_case_id: overallRankings[overallRankings.length - 1].case_id
  }

  const calculationTime = Date.now() - startTime
  console.log(`[Comparison Engine] Comparison completed in ${calculationTime}ms`)

  return {
    comparison_name: comparisonName,
    base_case_id: baseCaseId,
    cases,
    category_comparisons: categoryComparisons,
    overall_rankings: overallRankings,
    summary
  }
}

/**
 * Fetch latest assessment data for a case
 */
async function fetchCaseAssessment(
  connection: Connection,
  caseId: number
): Promise<CaseImpact | null> {
  // Get latest completed assessment
  const [assessmentRows] = await connection.query<RowDataPacket[]>(
    `SELECT run_id, run_name, case_id
     FROM assessment_runs
     WHERE case_id = ? AND status = 'completed'
     ORDER BY run_date DESC
     LIMIT 1`,
    [caseId]
  )

  if (assessmentRows.length === 0) {
    return null
  }

  const runId = assessmentRows[0].run_id

  // Get case details
  const [caseRows] = await connection.query<RowDataPacket[]>(
    `SELECT case_id, case_name, case_description
     FROM case_table
     WHERE case_id = ?`,
    [caseId]
  )

  // Get total impacts by category
  const [impactRows] = await connection.query<RowDataPacket[]>(
    `SELECT
       ic.category_id,
       ic.category_name,
       SUM(ar.impact_value) as impact_value,
       ic.unit,
       COUNT(DISTINCT ar.result_id) as flow_count
     FROM assessment_results ar
     JOIN impact_categories ic ON ar.category_id = ic.category_id
     WHERE ar.run_id = ?
     GROUP BY ic.category_id, ic.category_name, ic.unit`,
    [runId]
  )

  // Get component breakdown
  const [componentRows] = await connection.query<RowDataPacket[]>(
    `SELECT
       c.component_id,
       c.component_name,
       c.component_type,
       ic.category_id,
       ic.category_name,
       SUM(ar.impact_value) as impact_value,
       ic.unit
     FROM assessment_results ar
     JOIN component c ON ar.component_id = c.component_id
     JOIN impact_categories ic ON ar.category_id = ic.category_id
     WHERE ar.run_id = ?
     GROUP BY c.component_id, c.component_name, c.component_type, ic.category_id, ic.category_name, ic.unit
     ORDER BY c.component_id, ic.category_id`,
    [runId]
  )

  // Organize component breakdown
  const componentBreakdown: ComponentImpact[] = []
  const componentMap = new Map<number, ComponentImpact>()

  componentRows.forEach(row => {
    if (!componentMap.has(row.component_id)) {
      componentMap.set(row.component_id, {
        component_id: row.component_id,
        component_name: row.component_name,
        component_type: row.component_type,
        impacts: []
      })
    }
    componentMap.get(row.component_id)!.impacts.push({
      category_id: row.category_id,
      category_name: row.category_name,
      impact_value: parseFloat(row.impact_value),
      unit: row.unit,
      flow_count: 0
    })
  })

  return {
    case_id: caseId,
    case_name: caseRows[0].case_name,
    case_description: caseRows[0].case_description,
    run_id: runId,
    total_impacts: impactRows.map(row => ({
      category_id: row.category_id,
      category_name: row.category_name,
      impact_value: parseFloat(row.impact_value),
      unit: row.unit,
      flow_count: parseInt(row.flow_count)
    })),
    component_breakdown: Array.from(componentMap.values())
  }
}

/**
 * Compare cases by each impact category
 */
function compareByCategory(
  cases: CaseImpact[],
  baseCaseId: number
): CategoryComparison[] {
  // Get all unique categories
  const categorySet = new Set<string>()
  cases.forEach(c => {
    c.total_impacts.forEach(ti => categorySet.add(ti.category_name))
  })

  const comparisons: CategoryComparison[] = []

  categorySet.forEach(categoryName => {
    const values: CaseValue[] = []
    let categoryId = 0
    let unit = ''

    // Get base case value
    const baseCase = cases.find(c => c.case_id === baseCaseId)
    const baseImpact = baseCase?.total_impacts.find(ti => ti.category_name === categoryName)
    const baseValue = baseImpact?.impact_value || 0

    // Calculate values for each case
    cases.forEach(caseData => {
      const impact = caseData.total_impacts.find(ti => ti.category_name === categoryName)
      const absoluteValue = impact?.impact_value || 0

      if (impact) {
        categoryId = impact.category_id
        unit = impact.unit
      }

      const deltaFromBase = absoluteValue - baseValue
      const deltaPercentage = baseValue !== 0
        ? ((absoluteValue - baseValue) / baseValue) * 100
        : 0

      values.push({
        case_id: caseData.case_id,
        case_name: caseData.case_name,
        absolute_value: absoluteValue,
        delta_from_base: deltaFromBase,
        delta_percentage: deltaPercentage,
        rank: 0  // Will be set later
      })
    })

    // Rank cases (lower impact = better rank)
    values.sort((a, b) => a.absolute_value - b.absolute_value)
    values.forEach((v, idx) => v.rank = idx + 1)

    // Find best and worst
    const bestCaseId = values[0].case_id
    const worstCaseId = values[values.length - 1].case_id

    // Calculate variance
    const mean = values.reduce((sum, v) => sum + v.absolute_value, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v.absolute_value - mean, 2), 0) / values.length

    comparisons.push({
      category_id: categoryId,
      category_name: categoryName,
      unit,
      values,
      best_case_id: bestCaseId,
      worst_case_id: worstCaseId,
      variance
    })
  })

  return comparisons.sort((a, b) => a.category_name.localeCompare(b.category_name))
}

/**
 * Calculate overall rankings across all categories
 */
function calculateOverallRankings(
  cases: CaseImpact[],
  categoryComparisons: CategoryComparison[]
): OverallRanking[] {
  const rankings: OverallRanking[] = []

  cases.forEach(caseData => {
    // Sum all impacts
    const totalScore = caseData.total_impacts.reduce(
      (sum, impact) => sum + impact.impact_value,
      0
    )

    // Count wins and losses
    let wins = 0
    let losses = 0

    categoryComparisons.forEach(comp => {
      if (comp.best_case_id === caseData.case_id) wins++
      if (comp.worst_case_id === caseData.case_id) losses++
    })

    rankings.push({
      case_id: caseData.case_id,
      case_name: caseData.case_name,
      total_score: totalScore,
      normalized_score: 0,  // Will be set after sorting
      rank: 0,
      wins,
      losses
    })
  })

  // Sort by total score (lower is better)
  rankings.sort((a, b) => a.total_score - b.total_score)

  // Set ranks and normalized scores
  const maxScore = rankings[rankings.length - 1].total_score
  const minScore = rankings[0].total_score
  const range = maxScore - minScore

  rankings.forEach((ranking, idx) => {
    ranking.rank = idx + 1
    ranking.normalized_score = range > 0
      ? ((maxScore - ranking.total_score) / range) * 100
      : 100
  })

  return rankings
}

/**
 * Save comparison to database
 */
export async function saveComparison(
  connection: Connection,
  comparison: ComparisonResult,
  projectId: number,
  userId: number
): Promise<number> {
  const [result] = await connection.query<any>(
    `INSERT INTO comparison_runs (comparison_name, project_id, case_ids, base_case_id, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      comparison.comparison_name,
      projectId,
      JSON.stringify(comparison.cases.map(c => c.case_id)),
      comparison.base_case_id,
      userId
    ]
  )

  const comparisonId = result.insertId

  // Save category comparisons
  for (const catComp of comparison.category_comparisons) {
    await connection.query(
      `INSERT INTO comparison_results (comparison_id, category_id, category_name, case_results, best_case_id, worst_case_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        comparisonId,
        catComp.category_id,
        catComp.category_name,
        JSON.stringify(catComp.values),
        catComp.best_case_id,
        catComp.worst_case_id
      ]
    )
  }

  // Save metadata
  await connection.query(
    `INSERT INTO comparison_metadata (comparison_id, total_cases_compared, total_categories_analyzed, overall_best_case_id, overall_worst_case_id, assessment_run_ids)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      comparisonId,
      comparison.summary.total_cases_compared,
      comparison.summary.total_categories_analyzed,
      comparison.summary.overall_best_case_id,
      comparison.summary.overall_worst_case_id,
      JSON.stringify(comparison.cases.map(c => c.run_id))
    ]
  )

  return comparisonId
}
