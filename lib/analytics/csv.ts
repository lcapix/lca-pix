// CSV export of the analytics page: one row per case and category.

import type { AssessmentData } from './types'

/** Header plus one row per case and category; impact values with 4 decimals. Fields are not quoted. */
export function buildAnalyticsCsvRows(assessmentData: AssessmentData[]): string[][] {
  const csvRows: string[][] = []
  csvRows.push(['Case Name', 'Case Type', 'Category', 'Impact Value', 'Unit'])
  assessmentData.forEach((data) => {
    data.categories.forEach((cat) => {
      csvRows.push([
        data.caseName,
        data.caseType,
        cat.category_name,
        cat.impact_value.toFixed(4),
        cat.unit,
      ])
    })
  })
  return csvRows
}

/** Rows joined with commas and newlines. */
export function toCsvContent(csvRows: string[][]): string {
  return csvRows.map((row) => row.join(',')).join('\n')
}

/** Download name for the CSV, dated with the UTC day of `now`. */
export function analyticsCsvFilename(now: Date): string {
  return `lca-assessment-analysis-${now.toISOString().split('T')[0]}.csv`
}
