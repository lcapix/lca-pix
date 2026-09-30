import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { queryOne, execute, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError, reachableCasesFilter } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';
import { COLUMN_LIMITS, decimalMax, firstLengthError } from '@/lib/field-limits';

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
    } catch {
      /* before migrate-018 */
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
      // Only among the cases the caller reaches (B-A1), as on create.
      const only = await reachableCasesFilter(userId, caseData.project_id, 'case_table');
      const clash = await queryOne<any>(
        `SELECT case_id FROM case_table
          WHERE project_id = ? AND case_id <> ? AND LOWER(TRIM(case_name)) = LOWER(TRIM(?))${only.sql} LIMIT 1`,
        [caseData.project_id, caseId, case_name, ...only.params]
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

    // ISO 14044 reference flow (4.2.3.2) of THIS alternative: how much product
    // one functional unit needs, and how much product the entered data make.
    // Goal, functional unit and boundary are study-level (PUT /api/projects).
    // Separate statement so an environment without migrate-014 can still
    // rename a case; it only runs when one of these fields was sent.
    // The student's own reading of the result and what they assumed: ISO 14044's
    // reporting clause expects both, and they are printed in the report. Kept in
    // its own statement so a database without migrate-021 still saves the rest.
    const WRITEUP_FIELDS = ['interpretation', 'assumptions', 'learning_state'] as const;
    const writeup = WRITEUP_FIELDS.filter((k) => Object.prototype.hasOwnProperty.call(body, k));
    if (writeup.length) {
      const sets = writeup.map((k) => `${k} = ?`).join(', ');
      const values = writeup.map((k) => {
        const v = (body as any)[k];
        if (k === 'learning_state') return v === null || v === undefined ? null : JSON.stringify(v);
        return v === null || v === undefined ? null : String(v).slice(0, 20000);
      });
      try {
        await execute(`UPDATE case_table SET ${sets} WHERE case_id = ?`, [...values, caseId]);
      } catch (writeErr: any) {
        if (writeErr?.code !== 'ER_BAD_FIELD_ERROR') throw writeErr;
        // Saying "saved" when nothing was written is worse than failing: the
        // student would lose their interpretation and never know.
        console.warn('[case PUT] write-up columns missing (run migrate-021)');
        return NextResponse.json(
          {
            error:
              'Your write-up could not be saved: the database needs migration 021. Nothing else was changed.',
          },
          { status: 409 },
        );
      }
    }

    // The hand-in flag (migrate-022). Its own statement so a database without
    // the column still saves everything else.
    // A project has one hand-in (WRITE-1): marking this case clears the flag
    // on the project's other cases in the same transaction, so a new hand-in
    // replaces the previous one. The project row is locked first, so two
    // hand-ins marked at the same moment cannot both stay.
    if (Object.prototype.hasOwnProperty.call(body, 'is_final')) {
      const final = body.is_final ? 1 : 0;
      try {
        await transaction(async (conn) => {
          if (final) {
            await conn.query('SELECT project_id FROM project WHERE project_id = ? FOR UPDATE', [
              caseData.project_id,
            ]);
            await conn.query(
              `UPDATE case_table SET is_final = 0, finalized_at = NULL
                WHERE project_id = ? AND case_id <> ? AND is_final = 1`,
              [caseData.project_id, caseId],
            );
          }
          await conn.query(
            'UPDATE case_table SET is_final = ?, finalized_at = ' +
              (final ? 'CURRENT_TIMESTAMP' : 'NULL') +
              ' WHERE case_id = ?',
            [final, caseId],
          );
        });
      } catch (finalErr: any) {
        if (finalErr?.code !== 'ER_BAD_FIELD_ERROR') throw finalErr;
        return NextResponse.json(
          { error: 'Marking a hand-in needs migration 022. Nothing else was changed.' },
          { status: 409 },
        );
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
        console.warn('[case PUT] reference-flow columns missing (run migrate-014):', isoErr);
        return NextResponse.json(
          { error: 'Reference-flow fields are not available yet: the database needs migrate-014.' },
          { status: 409 },
        );
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
      `SELECT project_id FROM case_table WHERE case_id = ?`,
      [caseId]
    );

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const denied = await caseAccessDenied(userId, caseId, 'admin', { notFound: 'Case not found' });
    if (denied) return denied;

    await execute(`DELETE FROM case_table WHERE case_id = ?`, [caseId]);

    return NextResponse.json({ success: true, message: 'Case deleted' });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete case error:', error);
    return NextResponse.json({ error: 'Failed to delete case' }, { status: 500 });
  }
}
