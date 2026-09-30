/**
 * GET /api/cases/[caseId]/completeness — which layers of a comprehensive product
 * case are present, and which document would fill each gap. Powers the guided
 * case-assembly checklist and the "you're missing X" hint.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { assessCompleteness } from '@/lib/ingest/completeness';
import { parseId } from '@/lib/ids';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const userId = await requireAuth(request);
    const { caseId } = await params;
    const id = parseId(caseId);
    if (!id) return NextResponse.json({ error: 'Invalid case id' }, { status: 400 });

    const caseRow = await queryOne<any>(
      `SELECT case_id, case_name, project_id FROM case_table WHERE case_id = ?`,
      [id],
    );
    if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const denied = await caseAccessDenied(userId, id, undefined, { notFound: 'Case not found' });
    if (denied) return denied;

    const components = await query<any>(
      `SELECT component_type AS tier, labor_cost, energy_cost, material_cost,
              transportation_cost, overhead_cost, equipment_cost, opex, capex
         FROM component WHERE case_id = ?`,
      [id],
    );
    const flows = await query<any>(
      `SELECT s.substance_name, f.flow_type AS direction, f.unit
         FROM flows f
         JOIN component c ON c.component_id = f.component_id
         LEFT JOIN substances s ON s.substance_id = f.substance_id
        WHERE c.case_id = ?`,
      [id],
    );

    const report = assessCompleteness(components, flows);
    return NextResponse.json({ success: true, case_id: id, case_name: caseRow.case_name, report });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Completeness error:', error);
    return NextResponse.json({ error: 'Failed to compute completeness' }, { status: 500 });
  }
}
