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

    // The study's method and region, so a run dialog can start from them.
    try {
      const scope = await queryOne<any>(
        `SELECT lcia_method, region_code FROM project WHERE project_id = ?`,
        [caseData.project_id]
      );
      caseData.project_lcia_method = scope?.lcia_method ?? null;
      caseData.project_region_code = scope?.region_code ?? null;
    } catch {
      /* before migrate-018 */
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

    const body = await request.json();
    const { case_name, description, case_type } = body;

    await execute(
      `UPDATE case_table
       SET case_name = COALESCE(?, case_name),
           description = COALESCE(?, description),
           case_type = COALESCE(?, case_type)
       WHERE case_id = ?`,
      [case_name ?? null, description ?? null, case_type ?? null, caseId]
    );

    // ISO 14044 reference flow (4.2.3.2) of THIS alternative: how much product
    // one functional unit needs, and how much product the entered data make.
    // Goal, functional unit and boundary are study-level (PUT /api/projects).
    // Separate statement so an environment without migrate-014 can still
    // rename a case; it only runs when one of these fields was sent.
    const REF_FIELDS = ['reference_flow', 'reference_flow_unit', 'modeled_output'];
    if (REF_FIELDS.some((k) => Object.prototype.hasOwnProperty.call(body, k))) {
      const num = (v: unknown): number | null =>
        v === undefined || v === null || v === '' ? null : Number(v);
      const refFlow = num(body.reference_flow);
      const modeled = num(body.modeled_output);
      for (const [name, v] of [
        ['reference_flow', refFlow],
        ['modeled_output', modeled],
      ] as const) {
        if (v !== null && (!Number.isFinite(v) || v <= 0)) {
          return NextResponse.json({ error: `${name} must be a positive number` }, { status: 400 });
        }
      }
      try {
        await execute(
          `UPDATE case_table
           SET reference_flow = COALESCE(?, reference_flow),
               reference_flow_unit = COALESCE(?, reference_flow_unit),
               modeled_output = COALESCE(?, modeled_output)
           WHERE case_id = ?`,
          [refFlow, body.reference_flow_unit ?? null, modeled, caseId],
        );
        // The data basis IS the product's quantity in the tree: keep them equal.
        if (modeled !== null) {
          await execute(
            `UPDATE component SET quantity = ?
              WHERE case_id = ? AND parent_component_id IS NULL AND component_type = 'product'`,
            [modeled, caseId],
          );
        }
      } catch (isoErr) {
        console.warn('[case PUT] reference-flow columns missing (run migrate-014):', isoErr);
        return NextResponse.json(
          { error: 'Reference-flow fields are not available yet: the database needs migrate-014.' },
          { status: 409 },
        );
      }
    }

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
