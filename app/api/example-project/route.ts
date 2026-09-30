import { NextRequest, NextResponse } from 'next/server';
import { queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError } from '@/lib/route-guard';
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

    // One transaction: a failure part-way used to leave a half-built project
    // that the name check above then returned as `existed: true` (PROJ-2).
    const { projectId, caseId, missing } = await transaction(async (conn) => {
      const run = async (sql: string, params: unknown[]) => (await conn.query(sql, params))[0] as any;
      /** A column a later migration added: an older database just goes without. */
      const optional = async (sql: string, params: unknown[]) => {
        try {
          await run(sql, params);
        } catch (err: any) {
          if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
        }
      };

      const projectId = Number(
        (
          await run(`INSERT INTO project (project_name, description, owner_id) VALUES (?, ?, ?)`, [
            EXAMPLE_PROJECT.name,
            EXAMPLE_PROJECT.description,
            userId,
          ])
        ).insertId,
      );

      // Method, region and goal (migrate-018/014).
      await optional(
        'UPDATE project SET lcia_method = ?, region_code = ?, goal_statement = ? WHERE project_id = ?',
        [EXAMPLE_PROJECT.method, EXAMPLE_PROJECT.region, EXAMPLE_PROJECT.goal, projectId],
      );
      // PROJ-1: functional unit and boundary are study-level and live on the
      // PROJECT (migrate-014). Writing them to case_table threw
      // ER_BAD_FIELD_ERROR, which was swallowed along with the reference
      // flow in the same statement, so Run stayed disabled on the example.
      await optional(
        'UPDATE project SET functional_unit = ?, system_boundary = ? WHERE project_id = ?',
        [EXAMPLE_CASE.functionalUnit, EXAMPLE_CASE.boundary, projectId],
      );

      // The owner's membership row, as POST /api/projects creates for every
      // other project.
      const [owner] = await run(`SELECT permission_id FROM permissions WHERE permission_name = 'owner'`, []);
      if (owner?.permission_id != null) {
        await run('INSERT INTO project_members (project_id, user_id, permission_id) VALUES (?, ?, ?)', [
          projectId,
          userId,
          owner.permission_id,
        ]);
      }

      const caseId = Number(
        (
          await run('INSERT INTO case_table (project_id, created_by, case_name, case_type, description) VALUES (?, ?, ?, ?, ?)', [
            projectId,
            userId,
            EXAMPLE_CASE.name,
            'base',
            EXAMPLE_CASE.description,
          ])
        ).insertId,
      );

      // This alternative's reference flow and data basis (migrate-014).
      await optional(
        `UPDATE case_table
            SET reference_flow = ?, reference_flow_unit = ?, modeled_output = ?
          WHERE case_id = ?`,
        [EXAMPLE_CASE.referenceFlow, EXAMPLE_CASE.referenceFlowUnit, EXAMPLE_CASE.referenceFlow, caseId],
      );

      const productId = Number(
        (
          await run(
            `INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit, description)
             VALUES (?, ?, 'product', 1, ?, 'unit', ?)`,
            [caseId, EXAMPLE_CASE.name, EXAMPLE_CASE.referenceFlow, 'The finished part this study is about.'],
          )
        ).insertId,
      );

      const missing: string[] = [];

      for (const step of EXAMPLE_STEPS) {
        const stepId = Number(
          (
            await run(
              `INSERT INTO component
                 (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit)
               VALUES (?, ?, ?, 'operation', 2, 1, 'unit')`,
              [caseId, productId, step.name],
            )
          ).insertId,
        );

        await optional('UPDATE component SET life_cycle_stage = ? WHERE component_id = ?', [
          step.stage,
          stepId,
        ]);

        for (const flow of step.flows) {
          // Library substances only (a user's private one is never borrowed).
          let rows: any[];
          try {
            rows = await run(
              'SELECT substance_id FROM substances WHERE substance_name = ? AND is_custom = 0 LIMIT 1',
              [flow.substance],
            );
          } catch (err: any) {
            if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
            rows = await run('SELECT substance_id FROM substances WHERE substance_name = ? LIMIT 1', [
              flow.substance,
            ]);
          }
          const substance = rows?.[0];
          // A catalog without that substance simply gets a smaller example, and
          // the response says which lines were left out.
          if (!substance) {
            missing.push(flow.substance);
            continue;
          }
          await run(
            `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [stepId, substance.substance_id, flow.direction, flow.quantity, flow.unit, flow.note.slice(0, 255)],
          );
        }
      }

      return { projectId, caseId, missing };
    });

    return NextResponse.json({
      success: true,
      project_id: projectId,
      case_id: caseId,
      points: EXAMPLE_POINTS,
      skipped_substances: missing,
    });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Example project error:', error);
    return NextResponse.json({ error: 'Could not build the example' }, { status: 500 });
  }
}
