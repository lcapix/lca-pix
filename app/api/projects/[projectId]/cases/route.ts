import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';

// GET /api/projects/[projectId]/cases - Get all cases for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseId(projectIdParam);

    const denied = await projectAccessDenied(userId, projectId, undefined, { notFound: 'Project not found' });
    if (denied) return denied;

    // driver_count must reflect REAL attached flows (the flows table), not the
    // legacy `drivers` JSON column — otherwise the UI showed "0 drivers" even
    // when components had flows, which looked like corrupt/inconsistent data
    // across the project, results, and analytics views.
    const cases = await query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM component cm WHERE cm.case_id = c.case_id) AS component_count,
              (SELECT COUNT(*)
                 FROM flows f
                 INNER JOIN component cm ON f.component_id = cm.component_id
                WHERE cm.case_id = c.case_id) AS driver_count,
              -- Whether this case has been run, so a caller can tell a
              -- comparable case from an empty one without a request each.
              (SELECT COUNT(*) FROM assessment_runs ar WHERE ar.case_id = c.case_id) AS run_count
       FROM case_table c
       WHERE c.project_id = ?
       ORDER BY c.created_at DESC`,
      [projectId]
    );

    return NextResponse.json({ success: true, cases });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get cases error:', error);
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/cases - Create new case
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseId(projectIdParam);

    const denied = await projectAccessDenied(userId, projectId, 'editor', { notFound: 'Project not found' });
    if (denied) return denied;

    const { case_name, case_type, parent_case_id, description } = await request.json();

    if (!case_name || !case_type) {
      return NextResponse.json(
        { error: 'Case name and type are required' },
        { status: 400 }
      );
    }

    if (!['base', 'comparative'].includes(case_type)) {
      return NextResponse.json({ error: 'Invalid case type' }, { status: 400 });
    }

    // Two cases with the same name inside one project cannot be told apart in
    // the case list or in a comparison.
    const clash = await queryOne<any>(
      `SELECT case_id FROM case_table
        WHERE project_id = ? AND LOWER(TRIM(case_name)) = LOWER(TRIM(?)) LIMIT 1`,
      [projectId, case_name]
    );
    if (clash) {
      return NextResponse.json(
        { error: `This project already has a case called "${String(case_name).trim()}". Pick another name.` },
        { status: 409 }
      );
    }

    const caseId = await insert(
      `INSERT INTO case_table (project_id, case_name, case_type, description)
       VALUES (?, ?, ?, ?)`,
      [projectId, case_name, case_type, description || null]
    );

    const newCase = await queryOne(
      `SELECT c.*
       FROM case_table c
       WHERE c.case_id = ?`,
      [caseId]
    );

    return NextResponse.json({ success: true, case: newCase }, { status: 201 });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create case error:', error);
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}
