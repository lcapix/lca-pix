import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne, execute } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { planPlacement } from '@/lib/component-tree';
import {
  BadRequest,
  COMPONENT_TYPES,
  nonNegative,
  parseStage,
  parseCostColumns,
  loadCaseTree,
  updateExistingColumns,
} from '@/lib/component-fields';
import { parseId } from '@/lib/ids';

// GET /api/cases/[caseId]/components - Get all components for a case (hierarchy)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseId(caseIdParam);

    const caseData = await queryOne<any>(
      `SELECT project_id FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, caseId, undefined, { notFound: 'Case not found' });
    if (denied) return denied;

    const components = await query<any>(
      `SELECT c.*,
              parent.component_name as parent_component_name
       FROM component c
       LEFT JOIN component parent
         ON c.parent_component_id = parent.component_id AND parent.case_id = c.case_id
       WHERE c.case_id = ?
       ORDER BY c.component_type, c.created_at, c.component_id`,
      [caseId]
    );

    // Attach a real flow_count per component (from the flows table) so the
    // canvas cards can show the true number of attached flows instead of 0.
    // Isolated/best-effort: if the flows table is unavailable, components still
    // return with flow_count 0 rather than failing the whole request.
    try {
      const counts = await query<any>(
        `SELECT f.component_id, COUNT(*) AS flow_count
         FROM flows f
         INNER JOIN component c ON f.component_id = c.component_id
         WHERE c.case_id = ?
         GROUP BY f.component_id`,
        [caseId]
      );
      const byId = new Map<number, number>(
        (counts || []).map((r: any) => [Number(r.component_id), Number(r.flow_count)])
      );
      for (const comp of components as any[]) {
        comp.flow_count = byId.get(Number(comp.component_id)) ?? 0;
      }
    } catch (countErr) {
      console.warn('[components GET] flow_count join skipped:', countErr);
      for (const comp of components as any[]) comp.flow_count = comp.flow_count ?? 0;
    }

    return NextResponse.json({ success: true, components });
  } catch (error: any) {
    if (isAuthError(error)) {
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
    const caseId = parseId(caseIdParam);

    const caseData = await queryOne<any>(
      `SELECT project_id FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, caseId, 'editor', { notFound: 'Case not found' });
    if (denied) return denied;

    const body = await request.json();
    const {
      component_name,
      component_type,
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
      capex,
    } = body;

    if (!component_name || !component_type) {
      return NextResponse.json(
        { error: 'Component name and type are required' },
        { status: 400 }
      );
    }

    if (!COMPONENT_TYPES.includes(component_type)) {
      return NextResponse.json({ error: 'Invalid component type' }, { status: 400 });
    }

    // Validate everything before inserting. hierarchy_level is the DEPTH in
    // the tree (levels may be skipped by type), so it is derived from the
    // parent, which must be a step of THIS case (M1: a foreign id used to be
    // stored and its name echoed back).
    let level = 1;
    let stage: string | null | undefined;
    let costs: Array<[string, unknown]> = [];
    let qty: number | null;
    let opexValue: number | null;
    let capexValue: number | null;
    const parentId =
      parent_component_id === null || parent_component_id === undefined || parent_component_id === ''
        ? null
        : Number(parent_component_id);
    try {
      if (typeof component_name !== 'string' || !component_name.trim() || component_name.length > 200) {
        throw new BadRequest('Component name must be 1 to 200 characters');
      }
      if (parentId !== null) {
        if (!Number.isInteger(parentId)) throw new BadRequest('parent_component_id must be a step id');
        const plan = planPlacement(await loadCaseTree(caseId), null, parentId);
        if (!plan.ok) throw new BadRequest(plan.error);
        level = plan.level;
      }
      stage = parseStage(body);
      costs = parseCostColumns(body);
      qty = nonNegative('quantity', quantity);
      opexValue = nonNegative('opex', opex);
      capexValue = nonNegative('capex', capex);
    } catch (e) {
      if (e instanceof BadRequest) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const componentId = await insert(
      `INSERT INTO component
       (case_id, parent_component_id, component_name, component_type, hierarchy_level, description,
        process_type, driver_category, driver_type, drivers, quantity, unit, opex, capex)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        parentId,
        component_name,
        component_type,
        level,
        component_description ?? descriptionField ?? null,
        process_type ?? null,
        driver_category ?? null,
        driver_type ?? null,
        drivers ? (typeof drivers === 'string' ? drivers : JSON.stringify(drivers)) : null,
        qty ?? 1.0,
        unit ?? 'unit',
        opexValue,
        capexValue,
      ]
    );

    // Its own statement, so a database without migrate-022 can still create a
    // step; it simply has no stage and reads as production.
    if (stage) {
      try {
        await execute('UPDATE component SET life_cycle_stage = ? WHERE component_id = ?', [
          stage,
          componentId,
        ]);
      } catch (stageErr: any) {
        if (stageErr?.code !== 'ER_BAD_FIELD_ERROR') throw stageErr;
        console.warn('[component POST] life_cycle_stage missing (run migrate-022)');
      }
    }

    // Costs entered on the create form (they used to be dropped here).
    await updateExistingColumns(componentId, costs, 'component POST');

    const newComponent = await queryOne(
      `SELECT c.*, parent.component_name as parent_component_name
       FROM component c
       LEFT JOIN component parent
         ON c.parent_component_id = parent.component_id AND parent.case_id = c.case_id
       WHERE c.component_id = ?`,
      [componentId]
    );

    return NextResponse.json({ success: true, component: newComponent }, { status: 201 });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create component error:', error);
    return NextResponse.json({ error: 'Failed to create component' }, { status: 500 });
  }
}
