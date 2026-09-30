import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { queryOne, execute } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';

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

    const denied = await projectAccessDenied(userId, caseData.project_id, undefined, { notFound: 'Case not found' });
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

    const denied = await projectAccessDenied(userId, caseData.project_id, 'editor', { notFound: 'Case not found' });
    if (denied) return denied;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;
    const { case_name, description, case_type } = body;

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
    if (Object.prototype.hasOwnProperty.call(body, 'is_final')) {
      const final = body.is_final ? 1 : 0;
      try {
        await execute(
          'UPDATE case_table SET is_final = ?, finalized_at = ' +
            (final ? 'CURRENT_TIMESTAMP' : 'NULL') +
            ' WHERE case_id = ?',
          [final, caseId],
        );
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
      const num = (v: unknown): number | null =>
        v === undefined || v === null || v === '' ? null : Number(v);
      const refFlow = num(body.reference_flow);
      const modeled = num(body.modeled_output);
      for (const [name, v] of [
        ['reference_flow', refFlow],
        ['modeled_output', modeled],
      ] as const) {
        if (v !== null && (!Number.isFinite(v) || v <= 0)) {
          return NextResponse.json({ error: `${name} must be a positive number` }, { status: 400 });
        }
      }
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

    const denied = await projectAccessDenied(userId, caseData.project_id, 'admin', { notFound: 'Case not found' });
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
