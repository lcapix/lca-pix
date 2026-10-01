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
import { readJson } from '@/lib/http';
import { queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError, reachableCasesFilter } from '@/lib/route-guard';
import { copyCaseInventory, copyCaseReferenceFields } from '@/lib/case-copy';
import { parseId } from '@/lib/ids';
import { COLUMN_LIMITS, fitToColumn, lengthError } from '@/lib/field-limits';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseId(caseIdParam);

    const sourceCase = await queryOne<any>(
      `SELECT * FROM case_table WHERE case_id = ?`,
      [caseId]
    );
    if (!sourceCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, caseId, 'editor', { notFound: 'Case not found' });
    if (denied) return denied;

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

    // The body is optional (Duplicate with the default name sends none).
    const json = await readJson(request, { optional: true });
    if (!json.ok) return json.response;
    const body = json.body;
    const C = COLUMN_LIMITS.case_table;
    const askedName = typeof body.case_name === 'string' ? body.case_name.trim() : '';
    const nameError = lengthError('Case name', askedName, C.case_name);
    if (nameError) return NextResponse.json({ error: nameError }, { status: 400 });
    // The default name is composed here, so it is cut to fit rather than refused.
    const newName: string =
      askedName || `${fitToColumn(sourceCase.case_name, { kind: 'chars', max: C.case_name.max - ' (Copy)'.length })} (Copy)`;

    // Only among the cases the caller reaches (B-A1), as on create.
    const only = await reachableCasesFilter(userId, sourceCase.project_id, 'case_table');
    const clash = await queryOne<any>(
      `SELECT case_id FROM case_table
        WHERE project_id = ? AND LOWER(TRIM(case_name)) = LOWER(TRIM(?))${only.sql} LIMIT 1`,
      [sourceCase.project_id, newName, ...only.params]
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
        `INSERT INTO case_table (project_id, created_by, case_name, case_type, description, region_code)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          sourceCase.project_id,
          userId,
          newName,
          newType,
          fitToColumn(
            sourceCase.description
              ? `${sourceCase.description} [duplicated from "${sourceCase.case_name}"]`
              : `Duplicated from "${sourceCase.case_name}"`,
            C.description,
          ),
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
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Duplicate case error:', error);
    return NextResponse.json({ error: 'Failed to duplicate case' }, { status: 500 });
  }
}
