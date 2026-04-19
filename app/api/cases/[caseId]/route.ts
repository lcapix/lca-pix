import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

// GET /api/cases/[caseId] - Get single case details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseInt(caseIdParam);

    const caseData = await queryOne(
      `SELECT c.*
       FROM case_table c
       WHERE c.case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, caseData.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ success: true, case: caseData });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get case error:', error);
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
}

// PUT /api/cases/[caseId] - Update case
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseInt(caseIdParam);

    const caseData = await queryOne<any>(
      `SELECT project_id FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, caseData.project_id, 'editor');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { case_name, description, case_type } = await request.json();

    await execute(
      `UPDATE case_table 
       SET case_name = COALESCE(?, case_name),
           description = COALESCE(?, description),
           case_type = COALESCE(?, case_type)
       WHERE case_id = ?`,
      [case_name ?? null, description ?? null, case_type ?? null, caseId]
    );

    const updatedCase = await queryOne(
      `SELECT c.*
       FROM case_table c
       WHERE c.case_id = ?`,
      [caseId]
    );

    return NextResponse.json({ success: true, case: updatedCase });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update case error:', error);
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}

// DELETE /api/cases/[caseId] - Delete case
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseInt(caseIdParam);

    const caseData = await queryOne<any>(
      `SELECT project_id FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, caseData.project_id, 'admin');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await execute(`DELETE FROM case_table WHERE case_id = ?`, [caseId]);

    return NextResponse.json({ success: true, message: 'Case deleted' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete case error:', error);
    return NextResponse.json({ error: 'Failed to delete case' }, { status: 500 });
  }
}
