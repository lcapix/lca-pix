import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { execute, query, queryOne } from '@/lib/db-helpers'
import { jsonArray, jsonColumn } from '@/lib/compare/legacy'
import { isAuthError, projectAccessDenied } from '@/lib/route-guard'
import { parseId } from '@/lib/ids'

// One legacy saved comparison (see app/api/comparisons/route.ts).

const positiveInt = (v: unknown): number | null => {
  const n = parseId(v)
  return Number.isNaN(n) ? null : n
}

const notFound = () => NextResponse.json({ error: 'Comparison not found' }, { status: 404 })

// GET /api/comparisons/[comparisonId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ comparisonId: string }> }
) {
  try {
    const userId = await requireAuth(request)
    const comparisonId = positiveInt((await params).comparisonId)
    if (!comparisonId) return NextResponse.json({ error: 'Invalid comparison id' }, { status: 400 })

    const comparison = await queryOne<any>(
      `SELECT
         cr.comparison_id,
         cr.comparison_name,
         cr.project_id,
         cr.case_ids,
         cr.base_case_id,
         cr.comparison_type,
         cr.created_at,
         u.username AS created_by_username,
         p.project_name
       FROM comparison_runs cr
       LEFT JOIN account u ON cr.created_by = u.id
       JOIN project p ON cr.project_id = p.project_id
       WHERE cr.comparison_id = ?`,
      [comparisonId]
    )
    // A non-member learns nothing, not even that the comparison exists.
    if (!comparison) return notFound()
    const denied = await projectAccessDenied(userId, comparison.project_id, undefined, {
      notFound: 'Comparison not found',
    })
    if (denied) return denied

    const results = await query<any>(
      `SELECT result_id, category_id, category_name, case_results, best_case_id, worst_case_id
         FROM comparison_results
        WHERE comparison_id = ?
        ORDER BY category_name`,
      [comparisonId]
    )
    const metadataRow = await queryOne<any>(
      `SELECT total_cases_compared, total_categories_analyzed, overall_best_case_id,
              overall_worst_case_id, calculation_time_ms, assessment_run_ids
         FROM comparison_metadata
        WHERE comparison_id = ?`,
      [comparisonId]
    )

    const caseIds = jsonArray<number>(comparison.case_ids).map(Number).filter((n) => Number.isInteger(n) && n > 0)
    const cases = caseIds.length
      ? await query<any>(
          `SELECT case_id, case_name, description AS case_description
             FROM case_table
            WHERE case_id IN (${caseIds.map(() => '?').join(',')}) AND project_id = ?`,
          [...caseIds, comparison.project_id]
        )
      : []

    return NextResponse.json({
      success: true,
      comparison: {
        comparison_id: comparison.comparison_id,
        comparison_name: comparison.comparison_name,
        project_id: comparison.project_id,
        project_name: comparison.project_name,
        case_ids: caseIds,
        base_case_id: comparison.base_case_id,
        comparison_type: comparison.comparison_type,
        created_at: comparison.created_at,
        created_by_username: comparison.created_by_username,
        cases,
        category_comparisons: results.map((row: any) => ({
          ...row,
          case_results: jsonColumn<unknown>(row.case_results, []),
        })),
        metadata: metadataRow
          ? { ...metadataRow, assessment_run_ids: jsonArray<number>(metadataRow.assessment_run_ids) }
          : null,
      },
    })
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('[Comparison API Error]:', error)
    return NextResponse.json({ error: 'Failed to fetch comparison details' }, { status: 500 })
  }
}

// DELETE /api/comparisons/[comparisonId] - the creator (still a member), the
// project owner or a project admin.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ comparisonId: string }> }
) {
  try {
    const userId = await requireAuth(request)
    const comparisonId = positiveInt((await params).comparisonId)
    if (!comparisonId) return NextResponse.json({ error: 'Invalid comparison id' }, { status: 400 })

    const comparison = await queryOne<any>(
      `SELECT comparison_id, created_by, project_id FROM comparison_runs WHERE comparison_id = ?`,
      [comparisonId]
    )
    if (!comparison) return notFound()
    // The creator needs only to be a member still; anyone else a project admin.
    const denied = await projectAccessDenied(
      userId,
      comparison.project_id,
      comparison.created_by === userId ? undefined : 'admin',
      { notFound: 'Comparison not found', forbidden: 'Access denied - only creator or project admin can delete' }
    )
    if (denied) return denied

    await execute(`DELETE FROM comparison_runs WHERE comparison_id = ?`, [comparisonId])
    return NextResponse.json({ success: true, message: 'Comparison deleted successfully' })
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('[Comparison API Error]:', error)
    return NextResponse.json({ error: 'Failed to delete comparison' }, { status: 500 })
  }
}
