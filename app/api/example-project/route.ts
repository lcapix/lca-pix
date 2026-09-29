import { NextRequest, NextResponse } from 'next/server';
import { queryOne, insert, execute } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import {
  EXAMPLE_CASE,
  EXAMPLE_POINTS,
  EXAMPLE_PROJECT,
  EXAMPLE_STEPS,
} from '@/lib/example-case';

/**
 * Build the worked example in the signed-in account.
 *
 * Loaded on demand rather than at signup: it is one button on an empty
 * dashboard, it can be deleted like any other project, and a failure here can
 * never block somebody creating an account.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    // One example per account, so the button cannot litter the dashboard.
    const already = await queryOne<any>(
      'SELECT project_id FROM project WHERE owner_id = ? AND project_name = ? LIMIT 1',
      [userId, EXAMPLE_PROJECT.name],
    );
    if (already) {
      return NextResponse.json({
        success: true,
        project_id: already.project_id,
        existed: true,
        points: EXAMPLE_POINTS,
      });
    }

    const projectId = await insert(
      `INSERT INTO project (project_name, description, owner_id) VALUES (?, ?, ?)`,
      [EXAMPLE_PROJECT.name, EXAMPLE_PROJECT.description, userId],
    );

    // Method, region and the goal statement arrived with migrate-018/014; an
    // older database still gets a usable example without them.
    try {
      await execute(
        'UPDATE project SET lcia_method = ?, region_code = ?, goal_statement = ? WHERE project_id = ?',
        [EXAMPLE_PROJECT.method, EXAMPLE_PROJECT.region, EXAMPLE_PROJECT.goal, projectId],
      );
    } catch (err: any) {
      if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    }

    const caseId = await insert(
      'INSERT INTO case_table (project_id, case_name, case_type, description) VALUES (?, ?, ?, ?)',
      [projectId, EXAMPLE_CASE.name, 'base', EXAMPLE_CASE.description],
    );

    try {
      await execute(
        `UPDATE case_table
            SET functional_unit = ?, system_boundary = ?, reference_flow = ?,
                reference_flow_unit = ?, modeled_output = ?
          WHERE case_id = ?`,
        [
          EXAMPLE_CASE.functionalUnit,
          EXAMPLE_CASE.boundary,
          EXAMPLE_CASE.referenceFlow,
          EXAMPLE_CASE.referenceFlowUnit,
          EXAMPLE_CASE.referenceFlow,
          caseId,
        ],
      );
    } catch (err: any) {
      if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    }

    const productId = await insert(
      `INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit, description)
       VALUES (?, ?, 'product', 1, 1, 'unit', ?)`,
      [caseId, EXAMPLE_CASE.name, 'The finished part this study is about.'],
    );

    const missing: string[] = [];

    for (const step of EXAMPLE_STEPS) {
      const stepId = await insert(
        `INSERT INTO component
           (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit)
         VALUES (?, ?, ?, 'operation', 2, 1, 'unit')`,
        [caseId, productId, step.name],
      );

      try {
        await execute('UPDATE component SET life_cycle_stage = ? WHERE component_id = ?', [
          step.stage,
          stepId,
        ]);
      } catch (err: any) {
        if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
      }

      for (const flow of step.flows) {
        const substance = await queryOne<any>(
          'SELECT substance_id FROM substances WHERE substance_name = ? LIMIT 1',
          [flow.substance],
        );
        // A catalog without that substance simply gets a smaller example, and
        // the response says which lines were left out.
        if (!substance) {
          missing.push(flow.substance);
          continue;
        }
        await insert(
          `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [stepId, substance.substance_id, flow.direction, flow.quantity, flow.unit, flow.note.slice(0, 255)],
        );
      }
    }

    return NextResponse.json({
      success: true,
      project_id: projectId,
      case_id: caseId,
      points: EXAMPLE_POINTS,
      skipped_substances: missing,
    });
  } catch (error: any) {
    if (/Unauthorized|token/i.test(error?.message ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Example project error:', error);
    return NextResponse.json({ error: 'Could not build the example' }, { status: 500 });
  }
}
