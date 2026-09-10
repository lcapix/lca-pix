/**
 * POST /api/cases/[caseId]/duplicate
 *
 * Deep-copies a case: the case row, every component (with parent links
 * remapped onto the new ids), every flow, and all cost columns. The copy is
 * created as a comparative case by default (body { case_type } can override,
 * body { case_name } names it) — because the whole point of duplicating is
 * "keep the base, change one thing, compare".
 *
 * Assessment runs are NOT copied: they are the original case's history.
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseInt(caseIdParam);

    const sourceCase = await queryOne<any>(
      `SELECT * FROM case_table WHERE case_id = ?`,
      [caseId]
    );
    if (!sourceCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const hasAccess = await checkProjectAccess(userId, sourceCase.project_id, 'editor');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let body: any = {};
    try { body = await request.json(); } catch { /* empty body is fine */ }
    const newName: string = body.case_name || `${sourceCase.case_name} (Copy)`;
    const newType: string = ['base', 'comparative'].includes(body.case_type)
      ? body.case_type
      : 'comparative';

    const result = await transaction(async (conn) => {
      const [caseIns]: any = await conn.query(
        `INSERT INTO case_table (project_id, case_name, case_type, description, region_code)
         VALUES (?, ?, ?, ?, ?)`,
        [
          sourceCase.project_id,
          newName,
          newType,
          sourceCase.description
            ? `${sourceCase.description} [duplicated from "${sourceCase.case_name}"]`
            : `Duplicated from "${sourceCase.case_name}"`,
          sourceCase.region_code ?? null,
        ]
      );
      const newCaseId = caseIns.insertId;

      // Copy components in hierarchy order so parents exist before children.
      const [components]: any = await conn.query(
        `SELECT * FROM component WHERE case_id = ? ORDER BY hierarchy_level, component_id`,
        [caseId]
      );
      const idMap = new Map<number, number>();
      let flowsCopied = 0;

      for (const comp of components) {
        const [compIns]: any = await conn.query(
          `INSERT INTO component
             (case_id, component_name, component_type, parent_component_id,
              hierarchy_level, quantity, unit, description, process_type,
              driver_category, driver_type, drivers,
              opex, capex, labor_cost, energy_cost, transportation_cost,
              material_cost, equipment_cost, overhead_cost, currency,
              cost_allocation_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCaseId,
            comp.component_name,
            comp.component_type,
            comp.parent_component_id ? (idMap.get(comp.parent_component_id) ?? null) : null,
            comp.hierarchy_level,
            comp.quantity,
            comp.unit,
            comp.description,
            comp.process_type,
            comp.driver_category,
            comp.driver_type,
            comp.drivers,
            comp.opex,
            comp.capex,
            comp.labor_cost,
            comp.energy_cost,
            comp.transportation_cost,
            comp.material_cost,
            comp.equipment_cost ?? null,
            comp.overhead_cost ?? null,
            comp.currency,
            comp.cost_allocation_type,
          ]
        );
        idMap.set(comp.component_id, compIns.insertId);

        const [flowIns]: any = await conn.query(
          `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
           SELECT ?, substance_id, flow_type, quantity, unit, is_driver, driver_description
           FROM flows WHERE component_id = ?`,
          [compIns.insertId, comp.component_id]
        );
        flowsCopied += flowIns.affectedRows ?? 0;
      }

      return { newCaseId, components: idMap.size, flows: flowsCopied };
    });

    return NextResponse.json({
      success: true,
      case_id: result.newCaseId,
      case_name: newName,
      case_type: newType,
      components_copied: result.components,
      flows_copied: result.flows,
    }, { status: 201 });
  } catch (error: any) {
    if (
      error.message === 'No authentication token provided' ||
      error.message === 'Invalid or expired token'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Duplicate case error:', error);
    return NextResponse.json({ error: 'Failed to duplicate case' }, { status: 500 });
  }
}
