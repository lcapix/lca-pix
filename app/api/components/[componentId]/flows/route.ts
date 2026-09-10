import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';
import { convertQuantity, compatibleUnits } from '@/lib/units';

// GET /api/components/[componentId]/flows - Get all flows for a component
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseInt(componentIdParam);

    const component = await queryOne<any>(
      `SELECT ct.project_id 
       FROM component c
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, component.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // The live `flows` table columns are `direction` and `amount` (a migration
    // renamed them from flow_type/quantity). Querying/ordering by the old names
    // 500'd the whole fetch. We alias `direction AS flow_type` and
    // `amount AS quantity` so existing clients that read those keys keep working,
    // and surface `cas_number` so the inspector can show each flow's data source.
    // `s.unit` is intentionally omitted (absent in some environments); the flow's
    // own `unit` column carries the unit.
    // Prod schema: the flows table uses flow_type/quantity natively (NOT
    // direction/amount). `f.*` returns them; we add substance fields for the
    // inspector. `s.unit` is omitted (absent in some environments).
    const flows = await query(
      `SELECT f.*,
              s.substance_name, s.category as substance_category, s.cas_number
       FROM flows f
       LEFT JOIN substances s ON f.substance_id = s.substance_id
       WHERE f.component_id = ?
       ORDER BY f.flow_type, f.created_at`,
      [componentId]
    );

    return NextResponse.json({ success: true, flows });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get flows error:', error);
    return NextResponse.json({ error: 'Failed to fetch flows' }, { status: 500 });
  }
}

// POST /api/components/[componentId]/flows - Create new flow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseInt(componentIdParam);

    const component = await queryOne<any>(
      `SELECT ct.project_id 
       FROM component c
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, component.project_id, 'editor');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Prod schema: the flows table columns are flow_type / quantity (NOT
    // direction / amount). Accept either key from the client for resilience.
    const body = await request.json();
    const substance_id = body.substance_id;
    const flow_type = body.flow_type ?? body.direction;
    const quantity = body.quantity ?? body.amount;
    const unit = body.unit;
    const driver_description = body.driver_description ?? null;

    if (!substance_id || !flow_type || quantity === undefined || !unit) {
      return NextResponse.json(
        { error: 'Substance, flow_type, quantity, and unit are required' },
        { status: 400 }
      );
    }

    if (!['input', 'output'].includes(flow_type)) {
      return NextResponse.json({ error: 'Invalid flow_type (must be input or output)' }, { status: 400 });
    }

    // Unit guard: the entered unit must be convertible into the substance's
    // factor unit, or the assessment could only exclude this flow later. The
    // flow keeps the unit AS ENTERED (provenance); the engine converts at
    // calculation time.
    const substanceRow = await queryOne<any>(
      `SELECT unit AS default_unit, substance_name FROM substances WHERE substance_id = ?`,
      [substance_id]
    );
    if (substanceRow?.default_unit) {
      const conv = convertQuantity(1, unit, substanceRow.default_unit);
      if (!conv) {
        return NextResponse.json(
          {
            error: `Unit '${unit}' cannot be converted to '${substanceRow.default_unit}', the unit ${substanceRow.substance_name}'s impact factors are stored in. Compatible units: ${compatibleUnits(substanceRow.default_unit).join(', ') || substanceRow.default_unit}.`,
          },
          { status: 400 }
        );
      }
    }

    // Bug #9: default is_driver to TRUE so new flows count in assessments.
    const flowId = await insert(
      `INSERT INTO flows
         (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [componentId, substance_id, flow_type, quantity, unit, body.is_driver === false ? 0 : 1, driver_description]
    );

    const newFlow = await queryOne(
      `SELECT f.*,
              s.substance_name, s.category as substance_category, s.cas_number
       FROM flows f
       LEFT JOIN substances s ON f.substance_id = s.substance_id
       WHERE f.flow_id = ?`,
      [flowId]
    );

    return NextResponse.json({ success: true, flow: newFlow }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create flow error:', error);
    return NextResponse.json({ error: 'Failed to create flow' }, { status: 500 });
  }
}
