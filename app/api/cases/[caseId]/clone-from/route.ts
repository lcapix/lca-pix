import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, insert } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

// POST /api/cases/[caseId]/clone-from
// Body: { sourceCaseId: number }
// Duplicates every component from sourceCaseId into caseId, preserving the
// parent/child hierarchy. Target case must be empty.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const targetCaseId = parseInt(caseIdParam);
    const { sourceCaseId } = await request.json();

    if (!sourceCaseId || isNaN(targetCaseId)) {
      return NextResponse.json(
        { error: 'sourceCaseId and caseId required' },
        { status: 400 },
      );
    }

    const targetCase = await queryOne<any>(
      `SELECT project_id FROM case_table WHERE case_id = ?`,
      [targetCaseId],
    );
    const sourceCase = await queryOne<any>(
      `SELECT project_id FROM case_table WHERE case_id = ?`,
      [sourceCaseId],
    );

    if (!targetCase || !sourceCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    if (targetCase.project_id !== sourceCase.project_id) {
      return NextResponse.json(
        { error: 'Cases must belong to the same project' },
        { status: 400 },
      );
    }

    const hasAccess = await checkProjectAccess(
      userId,
      targetCase.project_id,
      'editor',
    );
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const existing = await query<any>(
      `SELECT COUNT(*) AS n FROM component WHERE case_id = ?`,
      [targetCaseId],
    );
    if (Number(existing[0]?.n ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Target case is not empty' },
        { status: 409 },
      );
    }

    const source = await query<any>(
      `SELECT * FROM component WHERE case_id = ? ORDER BY hierarchy_level, component_id`,
      [sourceCaseId],
    );

    const idMap = new Map<number, number>();
    for (const c of source) {
      const newParent =
        c.parent_component_id != null
          ? idMap.get(c.parent_component_id) ?? null
          : null;
      const newId = await insert(
        `INSERT INTO component
         (case_id, parent_component_id, component_name, component_type, hierarchy_level, description,
          process_type, driver_category, driver_type, drivers, quantity, unit, opex, capex)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetCaseId,
          newParent,
          c.component_name,
          c.component_type,
          c.hierarchy_level,
          c.description ?? null,
          c.process_type ?? null,
          c.driver_category ?? null,
          c.driver_type ?? null,
          c.drivers ? (typeof c.drivers === 'string' ? c.drivers : JSON.stringify(c.drivers)) : null,
          c.quantity ?? 1.0,
          c.unit ?? 'unit',
          c.opex ?? null,
          c.capex ?? null,
        ],
      );
      idMap.set(c.component_id, newId);
    }

    // Also clone the latest completed assessment + its results so the comp
    // case appears in Compare Cases / Analytics with real numbers. Scale
    // values by 0.72 to simulate an improvement scenario (-28%).
    const SCENARIO_SCALE = 0.72;
    let clonedRunId: number | null = null;
    try {
      const latestRun = await queryOne<any>(
        `SELECT * FROM assessment_runs
          WHERE case_id = ? AND status = 'completed'
          ORDER BY run_date DESC LIMIT 1`,
        [sourceCaseId],
      );
      if (latestRun) {
        clonedRunId = await insert(
          `INSERT INTO assessment_runs
           (case_id, run_name, calculation_method, status, executed_by, run_date)
           VALUES (?, ?, ?, 'completed', ?, NOW())`,
          [
            targetCaseId,
            `${latestRun.run_name ?? 'Cloned run'} (scenario)`,
            latestRun.calculation_method ?? 'CML 2001',
            userId,
          ],
        );
        const srcResults = await query<any>(
          `SELECT * FROM assessment_results WHERE run_id = ?`,
          [latestRun.run_id],
        );
        for (const r of srcResults) {
          const newComponentId =
            r.component_id != null ? idMap.get(r.component_id) ?? null : null;
          if (newComponentId == null) continue;
          await insert(
            `INSERT INTO assessment_results
             (run_id, component_id, category_id, impact_value, unit, contribution_percentage)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              clonedRunId,
              newComponentId,
              r.category_id,
              Number(r.impact_value) * SCENARIO_SCALE,
              r.unit,
              r.contribution_percentage,
            ],
          );
        }
      }
    } catch (e) {
      console.warn('Assessment clone skipped:', (e as Error)?.message);
    }

    return NextResponse.json({
      success: true,
      cloned: idMap.size,
      clonedRunId,
    });
  } catch (error: any) {
    if (
      error.message === 'Unauthorized' ||
      error.message === 'No authentication token provided' ||
      error.message === 'Invalid or expired token' ||
      error.message === 'User account not found or inactive'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Clone-from error:', error);
    return NextResponse.json(
      { error: 'Failed to clone components' },
      { status: 500 },
    );
  }
}
