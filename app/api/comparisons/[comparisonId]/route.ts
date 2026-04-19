import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import pool from '@/lib/db'
import { RowDataPacket } from 'mysql2/promise'

// GET /api/comparisons/[comparisonId] - Get detailed comparison results
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ comparisonId: string }> }
) {
  try {
    const userId = await requireAuth(request)
    const { comparisonId: comparisonIdParam } = await params
    const comparisonId = parseInt(comparisonIdParam)

    const connection = await pool.getConnection()

    try {
      // Get comparison basic info
      const [comparisonRows] = await connection.query<RowDataPacket[]>(
        `SELECT
           cr.comparison_id,
           cr.comparison_name,
           cr.project_id,
           cr.case_ids,
           cr.base_case_id,
           cr.comparison_type,
           cr.created_at,
           u.username as created_by_username,
           p.project_name
         FROM comparison_runs cr
         JOIN account u ON cr.created_by = u.id
         JOIN project p ON cr.project_id = p.project_id
         WHERE cr.comparison_id = ?`,
        [comparisonId]
      )

      if (comparisonRows.length === 0) {
        return NextResponse.json(
          { error: 'Comparison not found' },
          { status: 404 }
        )
      }

      const comparison = comparisonRows[0]

      // Verify user has access to project
      const [accessRows] = await connection.query<RowDataPacket[]>(
        `SELECT p.project_id
         FROM project p
         LEFT JOIN project_members pm ON p.project_id = pm.project_id
         WHERE p.project_id = ?
           AND (p.owner_id = ? OR pm.user_id = ?)
         LIMIT 1`,
        [comparison.project_id, userId, userId]
      )

      if (accessRows.length === 0) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }

      // Get comparison results by category
      const [resultsRows] = await connection.query<RowDataPacket[]>(
        `SELECT
           result_id,
           category_id,
           category_name,
           case_results,
           best_case_id,
           worst_case_id
         FROM comparison_results
         WHERE comparison_id = ?
         ORDER BY category_name`,
        [comparisonId]
      )

      // Get metadata
      const [metadataRows] = await connection.query<RowDataPacket[]>(
        `SELECT
           total_cases_compared,
           total_categories_analyzed,
           overall_best_case_id,
           overall_worst_case_id,
           calculation_time_ms,
           assessment_run_ids
         FROM comparison_metadata
         WHERE comparison_id = ?`,
        [comparisonId]
      )

      // Get case details
      const caseIds = JSON.parse(comparison.case_ids as string)
      const [caseRows] = await connection.query<RowDataPacket[]>(
        `SELECT case_id, case_name, description as case_description
         FROM case_table
         WHERE case_id IN (?)`,
        [caseIds]
      )

      // Parse JSON fields
      const categoryComparisons = resultsRows.map(row => ({
        ...row,
        case_results: JSON.parse(row.case_results as string)
      }))

      const metadata = metadataRows.length > 0 ? {
        ...metadataRows[0],
        assessment_run_ids: JSON.parse(metadataRows[0].assessment_run_ids as string || '[]')
      } : null

      // Assemble response
      const response = {
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
          cases: caseRows,
          category_comparisons: categoryComparisons,
          metadata
        }
      }

      return NextResponse.json(response)
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('[Comparison API Error]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comparison details' },
      { status: 500 }
    )
  }
}

// DELETE /api/comparisons/[comparisonId] - Delete a comparison
export async function DELETE(
  request: NextRequest,
  { params }: { params: { comparisonId: string } }
) {
  try {
    const userId = await requireAuth(request)
    const comparisonId = parseInt(params.comparisonId)

    const connection = await pool.getConnection()

    try {
      // Check if user created this comparison or is project admin
      const [comparisonRows] = await connection.query<RowDataPacket[]>(
        `SELECT cr.comparison_id, cr.created_by, cr.project_id
         FROM comparison_runs cr
         WHERE cr.comparison_id = ?`,
        [comparisonId]
      )

      if (comparisonRows.length === 0) {
        return NextResponse.json(
          { error: 'Comparison not found' },
          { status: 404 }
        )
      }

      const comparison = comparisonRows[0]

      // Check if user is creator or project admin
      const [accessRows] = await connection.query<RowDataPacket[]>(
        `SELECT p.project_id
         FROM project p
         LEFT JOIN project_members pm ON p.project_id = pm.project_id
         LEFT JOIN permissions perm ON pm.permission_id = perm.permission_id
         WHERE p.project_id = ?
           AND (p.owner_id = ? OR (pm.user_id = ? AND perm.permission_name = 'admin') OR ? = ?)
         LIMIT 1`,
        [comparison.project_id, userId, userId, userId, comparison.created_by]
      )

      if (accessRows.length === 0) {
        return NextResponse.json(
          { error: 'Access denied - only creator or project admin can delete' },
          { status: 403 }
        )
      }

      // Delete (cascades to related tables)
      await connection.query(
        `DELETE FROM comparison_runs WHERE comparison_id = ?`,
        [comparisonId]
      )

      return NextResponse.json({
        success: true,
        message: 'Comparison deleted successfully'
      })
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('[Comparison API Error]:', error)
    return NextResponse.json(
      { error: 'Failed to delete comparison' },
      { status: 500 }
    )
  }
}
