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

/**
 * Copy columns that later migrations added, when the source row has them.
 * Column names come from fixed lists in this file, never from the request.
 */
async function copyOptionalColumns(
  conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  table: 'case_table' | 'component',
  idColumn: 'case_id' | 'component_id',
  id: number,
  source: Record<string, unknown>,
  columns: string[],
): Promise<void> {
  const present = columns.filter((c) => Object.prototype.hasOwnProperty.call(source, c));
  if (present.length === 0) return;
  await conn.query(
    `UPDATE ${table} SET ${present.map((c) => `${c} = ?`).join(', ')} WHERE ${idColumn} = ?`,
    [...present.map((c) => source[c] ?? null), id],
  );
}

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

    // Copying a case whose steps have not landed yet produces a silently empty
    // copy (seen live: Duplicate pressed while a new comparative case was still
    // being populated). Refuse instead.
    const sourceSize = await queryOne<any>(
      `SELECT COUNT(*) AS n FROM component WHERE case_id = ?`,
      [caseId]
    );
    if (Number(sourceSize?.n ?? 0) === 0) {
      return NextResponse.json(
        { error: 'This case has no steps yet, so there is nothing to copy. Wait for it to finish loading, or import a document first.' },
        { status: 400 }
      );
    }

    let body: any = {};
    try { body = await request.json(); } catch { /* empty body is fine */ }
    const askedName = typeof body.case_name === 'string' ? body.case_name.trim().slice(0, 255) : '';
    const newName: string = askedName || `${sourceCase.case_name} (Copy)`;

    const clash = await queryOne<any>(
      `SELECT case_id FROM case_table
        WHERE project_id = ? AND LOWER(TRIM(case_name)) = LOWER(TRIM(?)) LIMIT 1`,
      [sourceCase.project_id, newName]
    );
    if (clash) {
      return NextResponse.json(
        { error: `This project already has a case called "${newName}". Name the copy after the change you are about to make.` },
        { status: 409 }
      );
    }
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

      // Columns added by later migrations are copied only where they exist
      // (SELECT * shows which): this alternative's reference flow and data basis.
      await copyOptionalColumns(conn, 'case_table', 'case_id', newCaseId, sourceCase, [
        'reference_flow',
        'reference_flow_unit',
        'modeled_output',
      ]);

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
        // Labor multiplicands and allocation, from later migrations.
        await copyOptionalColumns(conn, 'component', 'component_id', compIns.insertId, comp, [
          'labor_hours',
          'labor_occupation',
          'allocation_method',
          'allocation_factor',
          'allocation_note',
        ]);

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
