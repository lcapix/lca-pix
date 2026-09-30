import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { convertQuantity, compatibleUnits } from '@/lib/units';
import {
  parseFlowQuantity,
  QUANTITY_ERROR,
  findUsableSubstance,
  SUBSTANCE_ERROR,
} from '@/lib/flow-fields';
import { parseId } from '@/lib/ids';

// PUT /api/flows/[flowId] - Update flow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { flowId: flowIdParam } = await params;
    const flowId = parseId(flowIdParam);

    const existing = await queryOne<any>(
      `SELECT ct.project_id, c.case_id
       FROM flows f
       LEFT JOIN component c ON f.component_id = c.component_id
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE f.flow_id = ?`,
      [flowId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, existing.case_id, 'editor', { notFound: 'Flow not found' });
    if (denied) return denied;

    // Prod schema: flows columns are flow_type / quantity. Accept either key.
    const body = await request.json();
    const substance_id = body.substance_id;
    const flow_type = body.flow_type ?? body.direction;
    const quantityProvided =
      Object.prototype.hasOwnProperty.call(body, 'quantity') ||
      Object.prototype.hasOwnProperty.call(body, 'amount');
    const quantity = quantityProvided ? parseFlowQuantity(body.quantity ?? body.amount) : null;
    const unit = body.unit;

    // FLOW-4: quantity is NOT NULL and must be a real, non-negative number.
    if (quantityProvided && quantity === null) {
      return NextResponse.json({ error: QUANTITY_ERROR }, { status: 400 });
    }
    if (flow_type != null && !['input', 'output'].includes(flow_type)) {
      return NextResponse.json({ error: 'Invalid flow_type (must be input or output)' }, { status: 400 });
    }

    // L3: a swap may only go to a library substance or the caller's own one.
    let swappedTo: { default_unit?: string | null; substance_name?: string } | null = null;
    if (substance_id != null) {
      swappedTo = await findUsableSubstance(substance_id, userId);
      if (!swappedTo) {
        return NextResponse.json({ error: SUBSTANCE_ERROR }, { status: 400 });
      }
    }

    // Same save-time unit guard as flow creation: whichever unit this flow
    // ends up with must convert into the unit its substance's factors are
    // stored in, or the engine could only exclude the flow at run time.
    // A swap without a unit keeps the flow's current unit, which must still
    // convert into the new substance's unit.
    const effectiveUnit =
      unit ||
      (swappedTo
        ? (await queryOne<any>(`SELECT unit FROM flows WHERE flow_id = ?`, [flowId]))?.unit
        : null);
    if (effectiveUnit) {
      const effectiveSubstanceId =
        substance_id ??
        (await queryOne<any>(`SELECT substance_id FROM flows WHERE flow_id = ?`, [flowId]))
          ?.substance_id;
      if (effectiveSubstanceId) {
        const substanceRow =
          swappedTo ??
          (await queryOne<any>(
            `SELECT unit AS default_unit, substance_name FROM substances WHERE substance_id = ?`,
            [effectiveSubstanceId]
          ));
        if (substanceRow?.default_unit && !convertQuantity(1, effectiveUnit, substanceRow.default_unit)) {
          return NextResponse.json(
            {
              error: `Unit '${effectiveUnit}' cannot be converted to '${substanceRow.default_unit}', the unit ${substanceRow.substance_name}'s impact factors are stored in. Compatible units: ${compatibleUnits(substanceRow.default_unit).join(', ') || substanceRow.default_unit}.`,
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
      [substance_id != null ? Number(substance_id) : null, flow_type ?? null, quantity, unit ?? null, flowId]
    );

    // A quantity typed by hand is no longer the mass x distance a transport
    // leg was computed from (TKM-2): drop the leg rather than keep two
    // numbers that disagree.
    if (quantityProvided) {
      try {
        await execute(
          `UPDATE flows SET transport_mass_kg = NULL, transport_distance_km = NULL, transport_mode = NULL
            WHERE flow_id = ? AND transport_mass_kg IS NOT NULL
              AND ABS(transport_mass_kg / 1000 * transport_distance_km - quantity) > 0.000001 * GREATEST(1, ABS(quantity))`,
          [flowId],
        );
      } catch (legErr: any) {
        if (legErr?.code !== 'ER_BAD_FIELD_ERROR') throw legErr; // no migrate-022
      }
    }

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
    if (isAuthError(error)) {
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
    const flowId = parseId(flowIdParam);

    const existing = await queryOne<any>(
      `SELECT ct.project_id, c.case_id
       FROM flows f
       LEFT JOIN component c ON f.component_id = c.component_id
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE f.flow_id = ?`,
      [flowId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, existing.case_id, 'editor', { notFound: 'Flow not found' });
    if (denied) return denied;

    await execute(`DELETE FROM flows WHERE flow_id = ?`, [flowId]);

    return NextResponse.json({ success: true, message: 'Flow deleted' });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete flow error:', error);
    return NextResponse.json({ error: 'Failed to delete flow' }, { status: 500 });
  }
}
