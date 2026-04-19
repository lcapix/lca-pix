import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

// PUT /api/flows/[flowId] - Update flow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { flowId: flowIdParam } = await params;
    const flowId = parseInt(flowIdParam);

    const existing = await queryOne<any>(
      `SELECT ct.project_id 
       FROM flows f
       LEFT JOIN component c ON f.component_id = c.component_id
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE f.flow_id = ?`,
      [flowId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, existing.project_id, 'editor');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { substance_id, flow_type, quantity, unit, is_driver, driver_description } =
      await request.json();

    await execute(
      `UPDATE flows
       SET substance_id = COALESCE(?, substance_id),
           flow_type = COALESCE(?, flow_type),
           quantity = COALESCE(?, quantity),
           unit = COALESCE(?, unit),
           is_driver = COALESCE(?, is_driver),
           driver_description = COALESCE(?, driver_description)
       WHERE flow_id = ?`,
      [substance_id ?? null, flow_type ?? null, quantity ?? null, unit ?? null, is_driver !== undefined ? (is_driver ? 1 : 0) : null, driver_description ?? null, flowId]
    );

    const updatedFlow = await queryOne(
      `SELECT f.*, s.substance_name, s.category as substance_category
       FROM flows f
       LEFT JOIN substances s ON f.substance_id = s.substance_id
       WHERE f.flow_id = ?`,
      [flowId]
    );

    return NextResponse.json({ success: true, flow: updatedFlow });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update flow error:', error);
    return NextResponse.json({ error: 'Failed to update flow' }, { status: 500 });
  }
}

// DELETE /api/flows/[flowId] - Delete flow
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { flowId: flowIdParam } = await params;
    const flowId = parseInt(flowIdParam);

    const existing = await queryOne<any>(
      `SELECT ct.project_id 
       FROM flows f
       LEFT JOIN component c ON f.component_id = c.component_id
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE f.flow_id = ?`,
      [flowId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, existing.project_id, 'editor');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await execute(`DELETE FROM flows WHERE flow_id = ?`, [flowId]);

    return NextResponse.json({ success: true, message: 'Flow deleted' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete flow error:', error);
    return NextResponse.json({ error: 'Failed to delete flow' }, { status: 500 });
  }
}
