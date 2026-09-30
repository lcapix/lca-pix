import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError } from '@/lib/route-guard';

/**
 * The process library, in driver units (migrate-022 / 023).
 *
 * A template says what a process of its kind consumes and in which unit its
 * consumption should be measured: laser cutting per minute of cutting time,
 * powder coating per square metre coated. This is the patent's driver factor x
 * driver value made visible, and the one thing Sustainable Minds has that we
 * had nothing of.
 *
 * Amounts are mostly NULL by design: the library names what to look for, the
 * student supplies the number from their own machine, and the note on each line
 * says where that number usually lives.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    const templates = await query<any>(
      `SELECT template_id, template_name, process_family, driver_unit, driver_label,
              description, source_reference, is_custom
         FROM process_templates
        WHERE is_custom = 0 OR created_by = ?
        ORDER BY is_custom, process_family, template_name`,
      [userId],
    );

    if (templates.length === 0) {
      return NextResponse.json({ success: true, templates: [] });
    }

    const ids = templates.map((t: any) => t.template_id);
    const lines = await query<any>(
      `SELECT ptf.template_flow_id, ptf.template_id, ptf.substance_id, ptf.substance_hint,
              ptf.flow_type, ptf.amount_per_driver, ptf.unit, ptf.note, ptf.sort_order,
              s.substance_name, s.unit AS substance_unit
         FROM process_template_flows ptf
         LEFT JOIN substances s ON s.substance_id = ptf.substance_id
        WHERE ptf.template_id IN (${ids.map(() => '?').join(',')})
        ORDER BY ptf.template_id, ptf.sort_order, ptf.template_flow_id`,
      ids,
    );

    const byTemplate = new Map<number, any[]>();
    for (const l of lines as any[]) {
      if (!byTemplate.has(l.template_id)) byTemplate.set(l.template_id, []);
      byTemplate.get(l.template_id)!.push(l);
    }

    return NextResponse.json({
      success: true,
      templates: (templates as any[]).map((t) => ({ ...t, lines: byTemplate.get(t.template_id) ?? [] })),
    });
  } catch (error: any) {
    // A database without migrate-022 simply has no library yet.
    if (error?.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json({ success: true, templates: [] });
    }
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Process template list error:', error);
    return NextResponse.json({ error: 'Failed to load the process library' }, { status: 500 });
  }
}
