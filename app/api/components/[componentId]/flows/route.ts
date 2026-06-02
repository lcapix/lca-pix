import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

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

    // NOTE: actual DB columns are `flow_type` and `quantity` (not `direction`/`amount`).
    // The earlier session handoff aliased these for backward compatibility, but the
    // aliases pointed at non-existent source columns — fixed here.
    const flows = await query(
      `SELECT f.*,
              s.substance_name, s.category as substance_category, s.unit as substance_default_unit
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

    const { substance_id, flow_type, quantity, unit, is_driver, driver_description } =
      await request.json();

    if (!substance_id || !flow_type || quantity === undefined || !unit) {
      return NextResponse.json(
        { error: 'Substance, flow_type, quantity, and unit are required' },
        { status: 400 }
      );
    }

    if (!['input', 'output'].includes(flow_type)) {
      return NextResponse.json({ error: 'Invalid flow_type (must be input or output)' }, { status: 400 });
    }

    const flowId = await insert(
      `INSERT INTO flows
       (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        componentId,
        substance_id,
        flow_type,
        quantity,
        unit,
        is_driver ? 1 : 0,
        driver_description ?? null,
      ]
    );

    const newFlow = await queryOne(
      `SELECT f.*,
              s.substance_name, s.category as substance_category
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
