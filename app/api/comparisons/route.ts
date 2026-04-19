import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import pool from '@/lib/db'
import { compareCases, saveComparison } from '@/lib/comparison-engine'
import { RowDataPacket } from 'mysql2/promise'

// POST /api/comparisons - Create a new comparison
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const body = await request.json()
    const { comparison_name, case_ids, project_id } = body

    // Validate input
    if (!comparison_name || !case_ids || !project_id) {
      return NextResponse.json(
        { error: 'Missing required fields: comparison_name, case_ids, project_id' },
        { status: 400 }
      )
    }

    if (!Array.isArray(case_ids)) {
      return NextResponse.json(
        { error: 'case_ids must be an array' },
        { status: 400 }
      )
    }

    if (case_ids.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 cases required for comparison' },
        { status: 400 }
      )
    }

    if (case_ids.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 cases can be compared at once' },
        { status: 400 }
      )
    }

    const connection = await pool.getConnection()

    try {
      // Verify user has access to project
      const [projectRows] = await connection.query<RowDataPacket[]>(
        `SELECT p.project_id
         FROM project p
         LEFT JOIN project_members pm ON p.project_id = pm.project_id
         WHERE p.project_id = ?
           AND (p.owner_id = ? OR pm.user_id = ?)
         LIMIT 1`,
        [project_id, userId, userId]
      )

      if (projectRows.length === 0) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        )
      }

      // Verify all cases belong to the project
      const [caseRows] = await connection.query<RowDataPacket[]>(
        `SELECT case_id
         FROM case_table
         WHERE case_id IN (?) AND project_id = ?`,
        [case_ids, project_id]
      )

      if (caseRows.length !== case_ids.length) {
        return NextResponse.json(
          { error: 'One or more cases not found in this project' },
          { status: 400 }
        )
      }

      console.log(`[Comparison API] Running comparison: "${comparison_name}" with ${case_ids.length} cases`)

      // Note: We don't run the full comparison or save to database
      // Instead, we just verify the cases exist and redirect to analytics
      // The analytics page already shows comparisons between all cases

      return NextResponse.json({
        success: true,
        message: 'Cases verified. View comparison in analytics.',
        case_ids: case_ids,
        project_id: project_id
      })
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('[Comparison API Error]:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create comparison' },
      { status: 500 }
    )
  }
}

// GET /api/comparisons?project_id=X - Get all comparisons for a project
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id query parameter required' },
        { status: 400 }
      )
    }

    const connection = await pool.getConnection()

    try {
      // Verify access to project
      const [projectRows] = await connection.query<RowDataPacket[]>(
        `SELECT p.project_id
         FROM project p
         LEFT JOIN project_members pm ON p.project_id = pm.project_id
         WHERE p.project_id = ?
           AND (p.owner_id = ? OR pm.user_id = ?)
         LIMIT 1`,
        [projectId, userId, userId]
      )

      if (projectRows.length === 0) {
        return NextResponse.json(
          { error: 'Project not found or access denied' },
          { status: 404 }
        )
      }

      // Get comparisons with metadata
      const [comparisons] = await connection.query<RowDataPacket[]>(
        `SELECT
           cr.comparison_id,
           cr.comparison_name,
           cr.case_ids,
           cr.base_case_id,
           cr.comparison_type,
           cr.created_at,
           u.username as created_by_username,
           cm.total_cases_compared,
           cm.total_categories_analyzed,
           bc.case_name as base_case_name
         FROM comparison_runs cr
         JOIN account u ON cr.created_by = u.id
         LEFT JOIN comparison_metadata cm ON cr.comparison_id = cm.comparison_id
         LEFT JOIN case_table bc ON cr.base_case_id = bc.case_id
         WHERE cr.project_id = ?
         ORDER BY cr.created_at DESC`,
        [projectId]
      )

      // Parse JSON fields
      const parsedComparisons = comparisons.map(comp => ({
        ...comp,
        case_ids: JSON.parse(comp.case_ids as string)
      }))

      return NextResponse.json({
        success: true,
        comparisons: parsedComparisons
      })
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('[Comparison API Error]:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comparisons' },
      { status: 500 }
    )
  }
}
