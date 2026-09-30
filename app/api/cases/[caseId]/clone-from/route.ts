import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { projectAccessDenied } from '@/lib/route-guard';
import { copyCaseInventory, copyCaseReferenceFields } from '@/lib/case-copy';

// POST /api/cases/[caseId]/clone-from
// Body: { sourceCaseId: number }
// Deep-copies sourceCaseId's inventory into caseId: every step (costs, labor,
// allocation, life-cycle stage), every flow (with its transport leg) and the
// reference flow / data basis, in one transaction, with the same copy code as
// Duplicate. Target case must be empty.
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
      `SELECT * FROM case_table WHERE case_id = ?`,
      [sourceCaseId],
    );

    if (!targetCase || !sourceCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }
    // Access before comparing projects, so a non-member learns nothing about
    // either id (the 400 below would say both exist).
    const denied = await projectAccessDenied(userId, targetCase.project_id, 'editor', { notFound: 'Case not found' });
    if (denied) return denied;
    if (targetCase.project_id !== sourceCase.project_id) {
      return NextResponse.json(
        { error: 'Cases must belong to the same project' },
        { status: 400 },
      );
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

    // All or nothing: a half-copied case used to block the retry with the
    // "not empty" guard above.
    const copied = await transaction(async (conn) => {
      await copyCaseReferenceFields(conn, sourceCase, targetCaseId);
      return copyCaseInventory(conn, Number(sourceCaseId), targetCaseId);
    });

    // A cloned case has NO results until someone runs it. This used to copy
    // the source case's latest run and multiply every impact by 0.72 "to
    // simulate an improvement scenario", which put numbers on screen that no
    // calculation produced. A comparative case must earn its result from its
    // own flows (change something, then run).

    return NextResponse.json({
      success: true,
      cloned: copied.components,
      flows_copied: copied.flows,
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
