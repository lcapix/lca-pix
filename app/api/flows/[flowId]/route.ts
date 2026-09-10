import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';
import { convertQuantity, compatibleUnits } from '@/lib/units';

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

    // Prod schema: flows columns are flow_type / quantity. Accept either key.
    const body = await request.json();
    const substance_id = body.substance_id;
    const flow_type = body.flow_type ?? body.direction;
    const quantity = body.quantity ?? body.amount;
    const unit = body.unit;

    // Same save-time unit guard as flow creation: whichever unit this flow
    // ends up with must convert into the unit its substance's factors are
    // stored in, or the engine could only exclude the flow at run time.
    if (unit) {
      const effectiveSubstanceId =
        substance_id ??
        (await queryOne<any>(`SELECT substance_id FROM flows WHERE flow_id = ?`, [flowId]))
          ?.substance_id;
      if (effectiveSubstanceId) {
        const substanceRow = await queryOne<any>(
          `SELECT unit AS default_unit, substance_name FROM substances WHERE substance_id = ?`,
          [effectiveSubstanceId]
        );
        if (substanceRow?.default_unit && !convertQuantity(1, unit, substanceRow.default_unit)) {
          return NextResponse.json(
            {
              error: `Unit '${unit}' cannot be converted to '${substanceRow.default_unit}', the unit ${substanceRow.substance_name}'s impact factors are stored in. Compatible units: ${compatibleUnits(substanceRow.default_unit).join(', ') || substanceRow.default_unit}.`,
            },
            { status: 400 }
          );
        }
      }
    }

    await execute(
      `UPDATE flows
       SET substance_id = COALESCE(?, substance_id),
           flow_type = COALESCE(?, flow_type),
           quantity = COALESCE(?, quantity),
           unit = COALESCE(?, unit)
       WHERE flow_id = ?`,
      [substance_id ?? null, flow_type ?? null, quantity ?? null, unit ?? null, flowId]
    );

    const updatedFlow = await queryOne(
      `SELECT f.*,
              s.substance_name, s.category as substance_category, s.cas_number
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
