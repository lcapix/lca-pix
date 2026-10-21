import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { COLUMN_LIMITS, firstLengthError } from '@/lib/field-limits';
import { query, insert, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError, projectAccessDenied, reachableCasesFilter } from '@/lib/route-guard';
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
    // Members of a project that keeps cases apart list only their own (B-A1).
    const only = await reachableCasesFilter(userId, projectId);

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
       WHERE c.project_id = ?${only.sql}
       ORDER BY c.created_at DESC`,
      [projectId, ...only.params]
    );
    // A copy link only to a case in this list, one the caller reaches (B-A1).
    const listed = new Set((cases as any[]).map((c) => Number(c.case_id)));
    for (const c of cases as any[]) {
      if (c.parent_case_id != null && !listed.has(Number(c.parent_case_id))) c.parent_case_id = null;
    }

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

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const { case_name, case_type, parent_case_id, description } = json.body;

    if (!case_name || !case_type) {
      return NextResponse.json(
        { error: 'Case name and type are required' },
        { status: 400 }
      );
    }

    if (!['base', 'comparative'].includes(case_type)) {
      return NextResponse.json({ error: 'Invalid case type' }, { status: 400 });
    }
    const tooLong = firstLengthError([
      ['Case name', case_name, COLUMN_LIMITS.case_table.case_name],
      ['Description', description, COLUMN_LIMITS.case_table.description],
    ]);
    if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });

    // Two cases with the same name inside one project cannot be told apart in
    // the case list or in a comparison. Only among the cases the caller
    // reaches: a student must not learn another student's case names (B-A1).
    const only = await reachableCasesFilter(userId, projectId, 'case_table');
    const clash = await queryOne<any>(
      `SELECT case_id FROM case_table
        WHERE project_id = ? AND LOWER(TRIM(case_name)) = LOWER(TRIM(?))${only.sql} LIMIT 1`,
      [projectId, case_name, ...only.params]
    );
    if (clash) {
      return NextResponse.json(
        { error: `This project already has a case called "${String(case_name).trim()}". Pick another name.` },
        { status: 409 }
      );
    }

    // The case it is a copy of, if any: a case of this project the caller
    // reaches. Anything else reads as not found (B-A1), never as a link.
    let parentId: number | null = null;
    if (parent_case_id !== undefined && parent_case_id !== null && parent_case_id !== '') {
      parentId = parseId(parent_case_id);
      const parent = Number.isNaN(parentId)
        ? null
        : await queryOne<any>(`SELECT project_id FROM case_table WHERE case_id = ?`, [parentId]);
      if (!parent || Number(parent.project_id) !== projectId || (await caseAccessDenied(userId, parentId))) {
        return NextResponse.json({ error: 'The case to copy from was not found in this project' }, { status: 400 });
      }
    }

    const caseId = await insert(
      `INSERT INTO case_table (project_id, created_by, parent_case_id, case_name, case_type, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, userId, parentId, case_name, case_type, description || null]
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
