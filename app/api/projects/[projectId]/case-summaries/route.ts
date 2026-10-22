import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';
import { headlineOf } from '@/lib/summary/case-summary';

/**
 * Every case in a project with what it holds and its latest answer: who made
 * it, its steps and flows, its runs and the newest completed run's headline,
 * and whether it has a write-up. Read by the Cases list and People.
 *
 * Read from the case itself, not from a separate tracker, so it cannot drift
 * from the work.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseId(projectIdParam);

    const project = await queryOne<any>('SELECT project_id FROM project WHERE project_id = ?', [projectId]);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const denied = await projectAccessDenied(userId, projectId, undefined, { notFound: 'Project not found' });
    if (denied) return denied;

    const rows = await query<any>(
      `SELECT c.case_id, c.case_name, c.case_type, c.description, c.created_at, c.updated_at, c.created_by, c.parent_case_id,
              COALESCE(NULLIF(TRIM(creator.full_name), ''), creator.username) AS author,
              c.interpretation,
              (SELECT COUNT(*) FROM assessment_runs ar WHERE ar.case_id = c.case_id) AS run_count,
              (SELECT MAX(ar.run_date) FROM assessment_runs ar WHERE ar.case_id = c.case_id) AS last_run,
              (SELECT MAX(ar.run_id) FROM assessment_runs ar
                WHERE ar.case_id = c.case_id AND ar.status = 'completed') AS latest_run_id,
              (SELECT COUNT(*) FROM flows f
                 JOIN component cm ON cm.component_id = f.component_id
                WHERE cm.case_id = c.case_id AND f.quantity IS NULL) AS flows_missing_amount,
              (SELECT COUNT(*) FROM component cm WHERE cm.case_id = c.case_id) AS step_count,
              (SELECT COUNT(*) FROM flows f
                 JOIN component cm ON cm.component_id = f.component_id
                WHERE cm.case_id = c.case_id) AS flow_count
         FROM case_table c
         LEFT JOIN account creator ON creator.id = c.created_by
        WHERE c.project_id = ?
        ORDER BY c.created_at`,
      [projectId]
    );

    // Each case's latest completed run, with its headline number: one query
    // for the whole list, reading only the snapshot's totals and scale.
    const latestIds = rows.map((r) => Number(r.latest_run_id)).filter((id) => id > 0);
    const latest = new Map<number, any>();
    if (latestIds.length) {
      const runs = await query<any>(
        `SELECT run_id, case_id, run_date, calculation_method, region_code,
                run_snapshot->'totals' AS totals,
                run_snapshot->'goal_scope'->'per_fu_scale' AS per_fu_scale
           FROM assessment_runs WHERE run_id IN (${latestIds.map(() => '?').join(', ')})`,
        latestIds
      );
      for (const run of runs) latest.set(Number(run.run_id), run);
    }

    // A copy link only to a case in this list.
    const listed = new Set(rows.map((r) => Number(r.case_id)));
    const cases = rows.map((r) => {
      const run = latest.get(Number(r.latest_run_id));
      return {
        case_id: r.case_id,
        case_name: r.case_name,
        case_type: r.case_type,
        created_by: r.created_by == null ? null : Number(r.created_by),
        author: r.author ?? null,
        steps: Number(r.step_count ?? 0),
        flows: Number(r.flow_count ?? 0),
        runs: Number(r.run_count ?? 0),
        last_run: r.last_run ?? null,
        // Presence, not content: the case holds the text.
        has_interpretation: !!String(r.interpretation ?? '').trim(),
        updated_at: r.updated_at ?? r.created_at ?? null,
        created_at: r.created_at ?? null,
        description: r.description ?? null,
        copied_from: r.parent_case_id != null && listed.has(Number(r.parent_case_id)) ? Number(r.parent_case_id) : null,
        flows_missing_amount: Number(r.flows_missing_amount ?? 0),
        latest_run: run
          ? {
              run_id: Number(run.run_id),
              run_date: run.run_date,
              method: run.calculation_method,
              region: run.region_code,
              headline: headlineOf(run.totals, run.per_fu_scale),
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, cases });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Case summaries error:', error);
    return NextResponse.json({ error: 'Failed to load the cases' }, { status: 500 });
  }
}
