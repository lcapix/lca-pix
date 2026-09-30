import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { projectAccessDenied } from '@/lib/route-guard';
import { LESSONS, parseLearningState } from '@/lib/lessons';

/**
 * What an instructor needs to see: for every case in the project, how far the
 * student got and what they wrote.
 *
 * Progress is read from the case itself (lesson answers, the interpretation,
 * whether a run exists), not from a separate tracker, so it cannot drift from
 * the work. Nothing here grades anything: it says what exists.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseInt(projectIdParam);

    const project = await queryOne<any>('SELECT owner_id FROM project WHERE project_id = ?', [projectId]);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const denied = await projectAccessDenied(userId, projectId, undefined, { notFound: 'Project not found' });
    if (denied) return denied;

    // The write-up and lesson columns arrive with migrations 021 and 022; on a
    // database without them the view still lists the cases and their runs.
    const sql = (withWriteup: boolean, withFinal: boolean) =>
      `SELECT c.case_id, c.case_name, c.case_type, c.created_at, c.updated_at
              ${withWriteup ? ', c.interpretation, c.assumptions, c.learning_state' : ''}
              ${withFinal ? ', c.is_final, c.finalized_at' : ''},
              (SELECT COUNT(*) FROM assessment_runs ar WHERE ar.case_id = c.case_id) AS run_count,
              (SELECT MAX(ar.run_date) FROM assessment_runs ar WHERE ar.case_id = c.case_id) AS last_run,
              (SELECT COUNT(*) FROM component cm WHERE cm.case_id = c.case_id) AS step_count,
              (SELECT COUNT(*) FROM flows f
                 JOIN component cm ON cm.component_id = f.component_id
                WHERE cm.case_id = c.case_id) AS flow_count
         FROM case_table c
        WHERE c.project_id = ?
        ORDER BY c.created_at`;

    let rows: any[];
    try {
      rows = await query<any>(sql(true, true), [projectId]);
    } catch (err: any) {
      if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
      try {
        rows = await query<any>(sql(true, false), [projectId]);
      } catch (err2: any) {
        if (err2?.code !== 'ER_BAD_FIELD_ERROR') throw err2;
        rows = await query<any>(sql(false, false), [projectId]);
      }
    }

    const cases = rows.map((r) => {
      const state = parseLearningState(r.learning_state ?? null);
      const answered = LESSONS.filter((l) => state.lessons[l.id]?.correct === true).map((l) => l.id);
      return {
        case_id: r.case_id,
        case_name: r.case_name,
        case_type: r.case_type,
        steps: Number(r.step_count ?? 0),
        flows: Number(r.flow_count ?? 0),
        runs: Number(r.run_count ?? 0),
        last_run: r.last_run ?? null,
        // What the student wrote, as presence not content: the instructor opens
        // the case to read it.
        has_interpretation: !!String(r.interpretation ?? '').trim(),
        has_assumptions: !!String(r.assumptions ?? '').trim(),
        lessons_total: LESSONS.length,
        lessons_answered: answered,
        prediction_made: !!state.prediction,
        is_final: !!r.is_final,
        finalized_at: r.finalized_at ?? null,
        updated_at: r.updated_at ?? r.created_at ?? null,
      };
    });

    return NextResponse.json({ success: true, cases });
  } catch (error: any) {
    if (/Unauthorized|token/i.test(error?.message ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Project progress error:', error);
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 });
  }
}
