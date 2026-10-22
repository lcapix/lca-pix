import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';
import { HELD_REASON_TEXT, type HeldReason } from '@/lib/import/held-lines';

// GET /api/cases/[caseId]/held-lines — the import lines held for review on a
// case (migrate-040): the ones still held, or every one with ?all=1. Any member
// who reaches the case may read them.
export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const caseId = parseId((await params).caseId);
    const denied = await caseAccessDenied(userId, caseId, undefined, { notFound: 'Case not found' });
    if (denied) return denied;

    const all = request.nextUrl.searchParams.get('all') === '1';
    let rows: any[];
    try {
      rows = await query<any>(
        `SELECT h.held_id, h.line_kind, h.reason, h.step_name, h.substance_text, h.substance_id,
                s.substance_name, h.direction, h.quantity, h.unit, h.cost_category, h.amount, h.hours,
                h.occupation, h.provenance, h.status, h.resolved_flow_id, h.resolved_component_id,
                h.created_at, h.resolved_at
           FROM import_held_lines h
           LEFT JOIN substances s ON s.substance_id = h.substance_id
          WHERE h.case_id = ?${all ? '' : " AND h.status = 'held'"}
          ORDER BY h.held_id`,
        [caseId]
      );
    } catch (err: any) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
      rows = []; // before migrate-040 nothing is kept
    }
    const lines = rows.map((r) => ({
      ...r,
      quantity: r.quantity == null ? null : Number(r.quantity),
      amount: r.amount == null ? null : Number(r.amount),
      hours: r.hours == null ? null : Number(r.hours),
      reason_text: HELD_REASON_TEXT[r.reason as HeldReason] ?? r.reason,
    }));
    return NextResponse.json({ success: true, held: lines.filter((l) => l.status === 'held').length, lines });
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Held lines error:', error);
    return NextResponse.json({ error: 'Failed to fetch held lines' }, { status: 500 });
  }
}
