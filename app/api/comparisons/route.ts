import { NextRequest, NextResponse } from 'next/server'
import { readJson } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { query } from '@/lib/db-helpers'
import { jsonArray } from '@/lib/compare/legacy'
import { isAuthError, projectAccessDenied, reachableCasesFilter, unreachableCaseIds } from '@/lib/route-guard'

// Legacy saved comparisons. Nothing new is saved any more (Compare Cases at
// /project/[id]/comparison reads live runs); these routes only list what was
// saved before, for the "Saved comparisons" list on the Compare page.

const positiveInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

// POST /api/comparisons - checks the cases; saves nothing (see above).
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const json = await readJson(request)
    if (!json.ok) return json.response
    const { comparison_name, case_ids, project_id } = json.body

    if (!comparison_name || !case_ids || !project_id) {
      return NextResponse.json(
        { error: 'Missing required fields: comparison_name, case_ids, project_id' },
        { status: 400 }
      )
    }
    if (!Array.isArray(case_ids)) {
      return NextResponse.json({ error: 'case_ids must be an array' }, { status: 400 })
    }
    if (case_ids.length < 2) {
      return NextResponse.json({ error: 'At least 2 cases required for comparison' }, { status: 400 })
    }
    if (case_ids.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 cases can be compared at once' }, { status: 400 })
    }
    const projectId = positiveInt(project_id)
    const ids = case_ids.map(positiveInt)
    if (!projectId || ids.some((id) => id === null)) {
      return NextResponse.json({ error: 'project_id and case_ids must be ids' }, { status: 400 })
    }

    const denied = await projectAccessDenied(userId, projectId, undefined, { notFound: 'Project not found' })
    if (denied) return denied

    // A case the caller cannot reach (B-A1) counts as not in the project.
    const only = await reachableCasesFilter(userId, projectId, 'case_table')
    const caseRows = await query<any>(
      `SELECT case_id FROM case_table
        WHERE project_id = ? AND case_id IN (${ids.map(() => '?').join(',')})${only.sql}`,
      [projectId, ...ids, ...only.params]
    )
    if (caseRows.length !== new Set(ids).size) {
      return NextResponse.json({ error: 'One or more cases not found in this project' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      saved: false,
      message: 'Cases verified. Compare them on the Compare page.',
      case_ids: ids,
      project_id: projectId,
    })
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('[Comparison API Error]:', error)
    return NextResponse.json({ error: 'Failed to create comparison' }, { status: 500 })
  }
}

// GET /api/comparisons?project_id=X - the project's saved comparisons
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request)
    const projectId = positiveInt(new URL(request.url).searchParams.get('project_id'))
    if (!projectId) {
      return NextResponse.json({ error: 'project_id query parameter required' }, { status: 400 })
    }

    // Any member may read; to anyone else the project does not exist.
    const denied = await projectAccessDenied(userId, projectId, undefined, { notFound: 'Project not found' })
    if (denied) return denied

    const rows = await query<any>(
      `SELECT
         cr.comparison_id,
         cr.comparison_name,
         cr.case_ids,
         cr.base_case_id,
         cr.comparison_type,
         cr.created_at,
         u.username AS created_by_username,
         cm.total_cases_compared,
         cm.total_categories_analyzed,
         bc.case_name AS base_case_name
       FROM comparison_runs cr
       LEFT JOIN account u ON cr.created_by = u.id
       LEFT JOIN comparison_metadata cm ON cr.comparison_id = cm.comparison_id
       LEFT JOIN case_table bc ON cr.base_case_id = bc.case_id AND bc.project_id = cr.project_id
       WHERE cr.project_id = ?
       ORDER BY cr.created_at DESC, cr.comparison_id DESC`,
      [projectId]
    )

    const comparisons = rows.map((row: any) => ({
      ...row,
      case_ids: jsonArray<number>(row.case_ids).map(Number).filter(Number.isFinite),
    }))
    // A saved comparison that names a case the caller cannot reach (B-A1) is left out.
    const hidden = new Set(
      await unreachableCaseIds(userId, projectId, comparisons.flatMap((c: any) => [...c.case_ids, Number(c.base_case_id)]))
    )
    return NextResponse.json({
      success: true,
      comparisons: hidden.size
        ? comparisons.filter((c: any) => ![...c.case_ids, Number(c.base_case_id)].some((id) => hidden.has(id)))
        : comparisons,
    })
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('[Comparison API Error]:', error)
    return NextResponse.json({ error: 'Failed to fetch comparisons' }, { status: 500 })
  }
}
