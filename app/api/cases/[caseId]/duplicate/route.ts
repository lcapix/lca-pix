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
import { copyCaseInventory, copyCaseReferenceFields } from '@/lib/case-copy';

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

      // This alternative's reference flow and data basis, then every step
      // (costs, labor, allocation, stage) and flow (with its transport leg),
      // parents before children: lib/case-copy.ts, shared with clone-from.
      await copyCaseReferenceFields(conn, sourceCase, newCaseId);
      const copied = await copyCaseInventory(conn, caseId, newCaseId);

      return { newCaseId, components: copied.components, flows: copied.flows };
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
      error.message === 'Unauthorized' ||
      error.message === 'No authentication token provided' ||
      error.message === 'Invalid or expired token' ||
      error.message === 'User account not found or inactive'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Duplicate case error:', error);
    return NextResponse.json({ error: 'Failed to duplicate case' }, { status: 500 });
  }
}
