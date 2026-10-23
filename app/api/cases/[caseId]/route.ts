import { NextRequest, NextResponse } from 'next/server';
import { internalError, readJson } from '@/lib/http';
import { queryOne, execute } from '@/lib/db-helpers';
import { getProjectRole, requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { isSchemaGap } from '@/lib/db-errors';
import { parseId } from '@/lib/ids';
import { COLUMN_LIMITS, decimalMax, firstLengthError } from '@/lib/field-limits';
import { recordAudit } from '@/lib/audit';

// GET /api/cases/[caseId] - Get single case details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseId(caseIdParam);

    const caseData = await queryOne(
      `SELECT c.*
       FROM case_table c
       WHERE c.case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, caseId, undefined, { notFound: 'Case not found' });
    if (denied) return denied;

    // The study's method and region, so a run dialog can start from them.
    try {
      const scope = await queryOne<any>(
        `SELECT lcia_method, region_code FROM project WHERE project_id = ?`,
        [caseData.project_id]
      );
      caseData.project_lcia_method = scope?.lcia_method ?? null;
      caseData.project_region_code = scope?.region_code ?? null;
    } catch (scopeErr) {
      // Before migrate-018 only. Any other failure must not quietly turn a
      // TRACI or ReCiPe study into a CML run (the run dialog starts from this).
      if (!isSchemaGap(scopeErr)) throw scopeErr;
    }
    // The study's functional unit.
    try {
      const fu = await queryOne<any>(`SELECT functional_unit FROM project WHERE project_id = ?`, [caseData.project_id]);
      caseData.project_functional_unit = fu?.functional_unit ?? null;
    } catch (fuErr) {
      if (!isSchemaGap(fuErr)) throw fuErr;
      caseData.project_functional_unit = null;
    }

    // The caller's role in the case's project, so the editor can hide what a
    // "Can read" member cannot do (the write routes still check for themselves).
    const role = await getProjectRole(userId, Number(caseData.project_id));
    caseData.my_role = role;
    // The role in the project itself: whether the caller may make cases.
    caseData.project_role = role;

    // The copy link (E03 "Copy of the Base case"), named only when the caller
    // reaches that case too; otherwise not even its id is sent.
    caseData.copied_from = null;
    if (caseData.parent_case_id != null) {
      const parentId = Number(caseData.parent_case_id);
      if (await caseAccessDenied(userId, parentId)) {
        caseData.parent_case_id = null;
      } else {
        const parent = await queryOne<any>(`SELECT case_id, case_name FROM case_table WHERE case_id = ?`, [parentId]);
        caseData.copied_from = parent ? { case_id: Number(parent.case_id), case_name: parent.case_name } : null;
      }
    }

    return NextResponse.json({ success: true, case: caseData });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get case error:', error);
    return NextResponse.json({ error: 'Failed to fetch case' }, { status: 500 });
  }
}

// PUT /api/cases/[caseId] - Update case
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  // What this save has written so far, statement by statement: a later
  // statement that fails says exactly what was already saved, never
  // "nothing else was changed" after part of the edit went through.
  const saved: string[] = [];
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

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;
    const { case_name, description, case_type } = body;

    // Every string must fit its column before anything is written (strict
    // mode refuses a longer one: a 500, or the "needs migrate-014" 409 below).
    const C = COLUMN_LIMITS.case_table;
    const tooLong = firstLengthError([
      ['Case name', case_name, C.case_name],
      ['Description', description, C.description],
      ['Reference flow unit', body.reference_flow_unit, C.reference_flow_unit],
    ]);
    if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });
    if (case_type != null && !['base', 'comparative'].includes(case_type)) {
      return NextResponse.json({ error: 'Invalid case type' }, { status: 400 });
    }
    // reference_flow and modeled_output are DECIMAL(15,6): above 0 once
    // stored (at least 0.000001) and at most 999,999,999.999999.
    const num = (v: unknown): number | null =>
      v === undefined || v === null || v === '' ? null : Number(v);
    const refFlow = num(body.reference_flow);
    const modeled = num(body.modeled_output);
    const refMax = decimalMax(C.reference_flow);
    for (const [name, v] of [
      ['reference_flow', refFlow],
      ['modeled_output', modeled],
    ] as const) {
      if (v !== null && (!Number.isFinite(v) || v < 0.000001 || v > refMax)) {
        return NextResponse.json(
          { error: `${name} must be a positive number (0.000001 to ${refMax})` },
          { status: 400 }
        );
      }
    }

    if (case_name !== undefined && case_name !== null) {
      if (!String(case_name).trim()) {
        return NextResponse.json({ error: 'Case name is required' }, { status: 400 });
      }
      const clash = await queryOne<any>(
        `SELECT case_id FROM case_table
          WHERE project_id = ? AND case_id <> ? AND LOWER(TRIM(case_name)) = LOWER(TRIM(?)) LIMIT 1`,
        [caseData.project_id, caseId, case_name]
      );
      if (clash) {
        return NextResponse.json(
          { error: `This project already has a case called "${String(case_name).trim()}". Pick another name.` },
          { status: 409 }
        );
      }
    }

    await execute(
      `UPDATE case_table
       SET case_name = COALESCE(?, case_name),
           description = COALESCE(?, description),
           case_type = COALESCE(?, case_type)
       WHERE case_id = ?`,
      [case_name ?? null, description ?? null, case_type ?? null, caseId]
    );
    const named = { case_name: 'the name', description: 'the description', case_type: 'the case type' } as const;
    for (const [k, words] of Object.entries(named)) {
      if (Object.prototype.hasOwnProperty.call(body, k) && (body as any)[k] != null) saved.push(words);
    }
    const partial = (failed: string) =>
      NextResponse.json(
        { error: `${failed} ${saved.length ? `Saved: ${saved.join(', ')}.` : 'Nothing else was changed.'}`, saved },
        { status: 409 },
      );

    // ISO 14044 reference flow (4.2.3.2) of THIS alternative: how much product
    // one functional unit needs, and how much product the entered data make.
    // Goal, functional unit and boundary are study-level (PUT /api/projects).
    // Separate statement so an environment without migrate-014 can still
    // rename a case; it only runs when one of these fields was sent.
    // The person's own reading of the result and what they assumed: ISO 14044's
    // reporting clause expects both, and they are printed in the report. Kept in
    // its own statement so a database without migrate-021 still saves the rest.
    const WRITEUP_FIELDS = ['interpretation', 'assumptions'] as const;
    const writeup = WRITEUP_FIELDS.filter((k) => Object.prototype.hasOwnProperty.call(body, k));
    if (writeup.length) {
      const sets = writeup.map((k) => `${k} = ?`).join(', ');
      const values = writeup.map((k) => {
        const v = (body as any)[k];
        return v === null || v === undefined ? null : String(v).slice(0, 20000);
      });
      try {
        await execute(`UPDATE case_table SET ${sets} WHERE case_id = ?`, [...values, caseId]);
        saved.push('the write-up');
      } catch (writeErr: any) {
        if (writeErr?.code !== 'ER_BAD_FIELD_ERROR') throw writeErr;
        // Saying "saved" when nothing was written is worse than failing: the
        // author would lose their interpretation and never know.
        console.warn('[case PUT] write-up columns missing (run migrate-021)');
        return partial('Your write-up could not be saved: the database needs migration 021.');
      }
    }

    const REF_FIELDS = ['reference_flow', 'reference_flow_unit', 'modeled_output'];
    if (REF_FIELDS.some((k) => Object.prototype.hasOwnProperty.call(body, k))) {
      try {
        await execute(
          `UPDATE case_table
           SET reference_flow = COALESCE(?, reference_flow),
               reference_flow_unit = COALESCE(?, reference_flow_unit),
               modeled_output = COALESCE(?, modeled_output)
           WHERE case_id = ?`,
          [refFlow, body.reference_flow_unit ?? null, modeled, caseId],
        );
        // The data basis IS the product's quantity in the tree: keep them equal.
        if (modeled !== null) {
          await execute(
            `UPDATE component SET quantity = ?
              WHERE case_id = ? AND parent_component_id IS NULL AND component_type = 'product'`,
            [modeled, caseId],
          );
        }
      } catch (isoErr) {
        // Only a missing column is "not available yet"; any other failure is an error.
        if (!isSchemaGap(isoErr)) throw isoErr;
        console.warn('[case PUT] reference-flow columns missing (run migrate-014):', isoErr);
        return partial('Reference-flow fields are not available yet: the database needs migrate-014.');
      }
    }

    const updatedCase = await queryOne(
      `SELECT c.*
       FROM case_table c
       WHERE c.case_id = ?`,
      [caseId]
    );

    return NextResponse.json({ success: true, case: updatedCase });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (saved.length) {
      return internalError('case PUT', `Failed to update case. Saved: ${saved.join(', ')}; try again to save the rest.`, error, {
        extra: { saved },
      });
    }
    console.error('Update case error:', error);
    return NextResponse.json({ error: 'Failed to update case' }, { status: 500 });
  }
}

// DELETE /api/cases/[caseId] - Delete case
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { caseId: caseIdParam } = await params;
    const caseId = parseId(caseIdParam);

    const caseData = await queryOne<any>(
      `SELECT project_id, case_name, case_type, created_by FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, caseId, 'admin', { notFound: 'Case not found' });
    if (denied) return denied;

    await execute(`DELETE FROM case_table WHERE case_id = ?`, [caseId]);
    await recordAudit({
      userId,
      action: 'delete',
      table: 'case_table',
      recordId: caseId,
      before: {
        project_id: caseData.project_id,
        case_name: caseData.case_name,
        case_type: caseData.case_type,
        created_by: caseData.created_by ?? null,
      },
      request,
    });

    return NextResponse.json({ success: true, message: 'Case deleted' });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete case error:', error);
    return NextResponse.json({ error: 'Failed to delete case' }, { status: 500 });
  }
}
