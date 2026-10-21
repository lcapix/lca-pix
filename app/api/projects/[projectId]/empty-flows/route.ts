import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied, reachableCasesFilter } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';

/**
 * The flows left with no amount across a project's cases (E10 "Flows most
 * often left empty"): one row per substance, direction and step name, with
 * the cases that hold it, most cases first. A flow with no amount is left
 * out of a run (it is counted, not guessed), so these are the gaps a class
 * shares. Read from the flows themselves; only the cases the caller reaches
 * count (B-A1, D2), so a student sees their own gaps only.
 */

/** At most this many rows: the screen shows the top few. */
const MAX_ROWS = 50;

export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const { projectId: p } = await params;
    const projectId = parseId(p);
    const project = await queryOne<any>('SELECT project_id FROM project WHERE project_id = ?', [projectId]);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const denied = await projectAccessDenied(userId, projectId, undefined, { notFound: 'Project not found' });
    if (denied) return denied;
    const only = await reachableCasesFilter(userId, projectId);

    const rows = await query<any>(
      `SELECT COALESCE(s.substance_name, CONCAT('Substance #', f.substance_id)) AS substance,
              f.flow_type, cm.component_name AS step, c.case_id
         FROM flows f
         JOIN component cm ON cm.component_id = f.component_id
         JOIN case_table c ON c.case_id = cm.case_id
         LEFT JOIN substances s ON s.substance_id = f.substance_id
        WHERE c.project_id = ? AND f.quantity IS NULL${only.sql}`,
      [projectId, ...only.params]
    );

    const groups = new Map<string, { substance: string; direction: 'input' | 'output'; step: string; cases: Set<number> }>();
    for (const r of rows) {
      const direction = r.flow_type === 'output' ? 'output' : 'input';
      const key = `${r.substance}\u0000${direction}\u0000${r.step}`;
      const g = groups.get(key) ?? { substance: r.substance, direction, step: r.step, cases: new Set<number>() };
      g.cases.add(Number(r.case_id));
      groups.set(key, g);
    }
    const flows = [...groups.values()]
      .map((g) => ({ substance: g.substance, direction: g.direction, step: g.step, case_ids: [...g.cases].sort((a, b) => a - b) }))
      .sort((a, b) => b.case_ids.length - a.case_ids.length || a.substance.localeCompare(b.substance) || a.step.localeCompare(b.step));

    return NextResponse.json({ success: true, flows: flows.slice(0, MAX_ROWS), more: Math.max(0, flows.length - MAX_ROWS) });
  } catch (error: any) {
    if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Empty flows error:', error);
    return NextResponse.json({ error: 'Failed to read the empty flows' }, { status: 500 });
  }
}
