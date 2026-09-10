import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

// GET /api/components/[componentId] - Get single component
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseInt(componentIdParam);

    const component = await queryOne(
      `SELECT c.*, parent.component_name as parent_component_name,
              ct.project_id
       FROM component c
       LEFT JOIN component parent ON c.parent_component_id = parent.component_id
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, (component as any).project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ success: true, component });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get component error:', error);
    return NextResponse.json({ error: 'Failed to fetch component' }, { status: 500 });
  }
}

// PUT /api/components/[componentId] - Update component
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseInt(componentIdParam);

    const existing = await queryOne<any>(
      `SELECT ct.project_id 
       FROM component c
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, existing.project_id, 'editor');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      component_name,
      component_type,
      component_description,  // Can accept this from frontend
      description,            // Or this - use fallback
      parent_component_id,
      process_type,
      driver_category,
      driver_type,
      drivers,
      quantity,
      unit,
      opex,
      capex,
      // ABC Costing - Detailed cost breakdown
      labor_cost,
      energy_cost,
      transportation_cost,
      material_cost,
      equipment_cost,
      overhead_cost,
      currency,
      cost_allocation_type
    } = body;

    // Whether the caller explicitly sent a parent. We must distinguish
    // "not provided" (keep current parent) from "explicitly null" (detach →
    // make the node independent). COALESCE can't set NULL, so re-parenting to
    // independent needs a direct assignment when the key is present.
    const parentProvided = Object.prototype.hasOwnProperty.call(
      body,
      'parent_component_id',
    );

    const finalDescription = component_description || description || null;

    // Core update — name, type, placement (parent), drivers, quantity/unit,
    // and the always-present opex/capex columns. This MUST succeed for renames
    // and re-parenting, so it is isolated from the optional ABC cost columns.
    // Parent clause: when explicitly provided, set it directly (allows NULL =
    // detach to independent). Otherwise keep the existing parent via COALESCE.
    const parentClause = parentProvided
      ? 'parent_component_id = ?'
      : 'parent_component_id = COALESCE(?, parent_component_id)'
    const parentValue = parentProvided
      ? (parent_component_id ?? null)
      : (parent_component_id ?? null)

    await execute(
      `UPDATE component
       SET component_name = COALESCE(?, component_name),
           component_type = COALESCE(?, component_type),
           description = COALESCE(?, description),
           ${parentClause},
           process_type = COALESCE(?, process_type),
           driver_category = COALESCE(?, driver_category),
           driver_type = COALESCE(?, driver_type),
           drivers = COALESCE(?, drivers),
           quantity = COALESCE(?, quantity),
           unit = COALESCE(?, unit),
           opex = COALESCE(?, opex),
           capex = COALESCE(?, capex)
       WHERE component_id = ?`,
      [
        component_name ?? null,
        component_type ?? null,
        finalDescription,
        parentValue,
        process_type ?? null,
        driver_category ?? null,
        driver_type ?? null,
        drivers ? (typeof drivers === 'string' ? drivers : JSON.stringify(drivers)) : null,
        quantity ?? null,
        unit ?? null,
        opex ?? null,
        capex ?? null,
        componentId
      ]
    );

    // Optional ABC cost-breakdown columns. These were added by a later
    // migration and may not exist in every environment's `component` table.
    // Update them in a separate, best-effort statement so a missing column can
    // never block a rename or re-parent. Only runs when at least one cost field
    // was actually provided.
    const hasCostFields =
      labor_cost != null ||
      energy_cost != null ||
      transportation_cost != null ||
      material_cost != null ||
      equipment_cost != null ||
      overhead_cost != null ||
      currency != null ||
      cost_allocation_type != null;
    if (hasCostFields) {
      try {
        await execute(
          `UPDATE component
           SET labor_cost = COALESCE(?, labor_cost),
               energy_cost = COALESCE(?, energy_cost),
               transportation_cost = COALESCE(?, transportation_cost),
               material_cost = COALESCE(?, material_cost),
               equipment_cost = COALESCE(?, equipment_cost),
               overhead_cost = COALESCE(?, overhead_cost),
               currency = COALESCE(?, currency),
               cost_allocation_type = COALESCE(?, cost_allocation_type)
           WHERE component_id = ?`,
          [
            labor_cost ?? null,
            energy_cost ?? null,
            transportation_cost ?? null,
            material_cost ?? null,
            equipment_cost ?? null,
            overhead_cost ?? null,
            currency ?? null,
            cost_allocation_type ?? null,
            componentId,
          ]
        );
      } catch (costErr) {
        console.warn('[component PUT] cost-column update skipped (schema lacks ABC cost columns):', costErr);
      }
    }

    const updatedComponent = await queryOne(
      `SELECT c.*, parent.component_name as parent_component_name
       FROM component c
       LEFT JOIN component parent ON c.parent_component_id = parent.component_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    return NextResponse.json({ success: true, component: updatedComponent });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update component error:', error);
    return NextResponse.json({ error: 'Failed to update component' }, { status: 500 });
  }
}

// DELETE /api/components/[componentId] - Delete component
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ componentId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { componentId: componentIdParam } = await params;
    const componentId = parseInt(componentIdParam);

    const existing = await queryOne<any>(
      `SELECT ct.project_id 
       FROM component c
       LEFT JOIN case_table ct ON c.case_id = ct.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, existing.project_id, 'admin');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await execute(`DELETE FROM component WHERE component_id = ?`, [componentId]);

    return NextResponse.json({ success: true, message: 'Component deleted' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete component error:', error);
    return NextResponse.json({ error: 'Failed to delete component' }, { status: 500 });
  }
}
