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

    // A cloned case has NO results until someone runs it. This used to copy
    // the source case's latest run and multiply every impact by 0.72 "to
    // simulate an improvement scenario", which put numbers on screen that no
    // calculation produced. A comparative case must earn its result from its
    // own flows (change something, then run).

    return NextResponse.json({
      success: true,
      cloned: idMap.size,
      clonedRunId: null,
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
