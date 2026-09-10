import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

// GET /api/projects/[projectId]/cases - Get all cases for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseInt(projectIdParam);

    const hasAccess = await checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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
                WHERE cm.case_id = c.case_id) AS driver_count
       FROM case_table c
       WHERE c.project_id = ?
       ORDER BY c.created_at DESC`,
      [projectId]
    );

    return NextResponse.json({ success: true, cases });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
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
    const projectId = parseInt(projectIdParam);

    const hasAccess = await checkProjectAccess(userId, projectId, 'editor');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create case error:', error);
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}
