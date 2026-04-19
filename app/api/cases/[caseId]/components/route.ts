import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

// GET /api/cases/[caseId]/components - Get all components for a case (hierarchy)
export async function GET(
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

    const hasAccess = await checkProjectAccess(userId, caseData.project_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const components = await query(
      `SELECT c.*,
              parent.component_name as parent_component_name
       FROM component c
       LEFT JOIN component parent ON c.parent_component_id = parent.component_id
       WHERE c.case_id = ?
       ORDER BY c.component_type, c.created_at`,
      [caseId]
    );

    // 🔍 DEBUG: Log first component's ABC cost data
    if (components && components.length > 0) {
      const firstComp = components[0];
      console.log('🔍 API DEBUG - First component ABC cost data:', {
        component_id: firstComp.component_id,
        component_name: firstComp.component_name,
        labor_cost: firstComp.labor_cost,
        energy_cost: firstComp.energy_cost,
        transportation_cost: firstComp.transportation_cost,
        material_cost: firstComp.material_cost,
        equipment_cost: firstComp.equipment_cost,
        overhead_cost: firstComp.overhead_cost,
        currency: firstComp.currency,
        opex: firstComp.opex,
        capex: firstComp.capex
      });
    }

    return NextResponse.json({ success: true, components });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get components error:', error);
    return NextResponse.json({ error: 'Failed to fetch components' }, { status: 500 });
  }
}

// POST /api/cases/[caseId]/components - Create new component
export async function POST(
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

    const {
      component_name,
      component_type,
      hierarchy_level,
      parent_component_id,
      component_description,
      description: descriptionField,
      process_type,
      driver_category,
      driver_type,
      drivers,
      quantity,
      unit,
      opex,
      capex
    } = await request.json();

    if (!component_name || !component_type) {
      return NextResponse.json(
        { error: 'Component name and type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'];
    if (!validTypes.includes(component_type)) {
      return NextResponse.json({ error: 'Invalid component type' }, { status: 400 });
    }

    // Auto-determine hierarchy level from type if not provided
    const levelMap: Record<string, number> = { product: 1, machine_line: 2, subprocess: 3, operation: 4, elemental_task: 5 };
    const level = hierarchy_level || levelMap[component_type] || 1;

    const componentId = await insert(
      `INSERT INTO component
       (case_id, parent_component_id, component_name, component_type, hierarchy_level, description,
        process_type, driver_category, driver_type, drivers, quantity, unit, opex, capex)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        parent_component_id ?? null,
        component_name,
        component_type,
        level,
        component_description ?? descriptionField ?? null,
        process_type ?? null,
        driver_category ?? null,
        driver_type ?? null,
        drivers ? (typeof drivers === 'string' ? drivers : JSON.stringify(drivers)) : null,
        quantity ?? 1.0,
        unit ?? 'unit',
        opex ?? null,
        capex ?? null
      ]
    );

    const newComponent = await queryOne(
      `SELECT c.*, parent.component_name as parent_component_name
       FROM component c
       LEFT JOIN component parent ON c.parent_component_id = parent.component_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    return NextResponse.json({ success: true, component: newComponent }, { status: 201 });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create component error:', error);
    return NextResponse.json({ error: 'Failed to create component' }, { status: 500 });
  }
}
