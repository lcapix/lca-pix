import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied, reachableCasesFilter } from '@/lib/route-guard';
import { LESSONS, parseLearningState } from '@/lib/lessons';
import { parseId } from '@/lib/ids';
import { headlineOf, pipelineStage } from '@/lib/summary/case-summary';

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
    const projectId = parseId(projectIdParam);

    const project = await queryOne<any>('SELECT owner_id, members_see_own_cases FROM project WHERE project_id = ?', [projectId]);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const denied = await projectAccessDenied(userId, projectId, undefined, { notFound: 'Project not found' });
    if (denied) return denied;
    // With "members see only their own cases" on, a student's view holds only
    // their own cases; the instructor's (owner, admins) holds every case (B-A1).
    const only = await reachableCasesFilter(userId, projectId);

    // The write-up and lesson columns arrive with migrations 021 and 022; on a
    // database without them the view still lists the cases and their runs.
    const sql = (withWriteup: boolean, withFinal: boolean) =>
      `SELECT c.case_id, c.case_name, c.case_type, c.description, c.created_at, c.updated_at, c.created_by, c.parent_case_id,
              COALESCE(NULLIF(TRIM(creator.full_name), ''), creator.username) AS author
              ${withWriteup ? ', c.interpretation, c.assumptions, c.learning_state' : ''}
              ${withFinal ? ', c.is_final, c.finalized_at' : ''},
              (SELECT COUNT(*) FROM assessment_runs ar WHERE ar.case_id = c.case_id) AS run_count,
              (SELECT MAX(ar.run_date) FROM assessment_runs ar WHERE ar.case_id = c.case_id) AS last_run,
              (SELECT COUNT(*) FROM assessment_runs ar
                WHERE ar.case_id = c.case_id AND ar.status = 'completed') AS completed_runs,
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
        WHERE c.project_id = ?${only.sql}
        ORDER BY c.created_at`;

    let rows: any[];
    try {
      rows = await query<any>(sql(true, true), [projectId, ...only.params]);
    } catch (err: any) {
      if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
      try {
        rows = await query<any>(sql(true, false), [projectId, ...only.params]);
      } catch (err2: any) {
        if (err2?.code !== 'ER_BAD_FIELD_ERROR') throw err2;
        rows = await query<any>(sql(false, false), [projectId, ...only.params]);
      }
    }

    // Each case's latest completed run, with its headline number: one query
    // for the whole list, reading only the snapshot's totals and scale.
    const latestIds = rows.map((r) => Number(r.latest_run_id)).filter((id) => id > 0);
    const latest = new Map<number, any>();
    if (latestIds.length) {
      const runs = await query<any>(
        `SELECT run_id, case_id, run_date, calculation_method, region_code,
                JSON_EXTRACT(run_snapshot, '$.totals') AS totals,
                JSON_EXTRACT(run_snapshot, '$.goal_scope.per_fu_scale') AS per_fu_scale
           FROM assessment_runs WHERE run_id IN (${latestIds.map(() => '?').join(', ')})`,
        latestIds
      );
      for (const run of runs) latest.set(Number(run.run_id), run);
    }

    // A copy link only to a case in this list: one the caller reaches (B-A1).
    const listed = new Set(rows.map((r) => Number(r.case_id)));
    const cases = rows.map((r) => {
      const state = parseLearningState(r.learning_state ?? null);
      const run = latest.get(Number(r.latest_run_id));
      const hasInterpretation = !!String(r.interpretation ?? '').trim();
      const answered = LESSONS.filter((l) => state.lessons[l.id]?.correct === true).map((l) => l.id);
      return {
        case_id: r.case_id,
        case_name: r.case_name,
        case_type: r.case_type,
        // Who made the case, so an instructor can tell submissions apart.
        created_by: r.created_by == null ? null : Number(r.created_by),
        author: r.author ?? null,
        steps: Number(r.step_count ?? 0),
        flows: Number(r.flow_count ?? 0),
        runs: Number(r.run_count ?? 0),
        last_run: r.last_run ?? null,
        // What the student wrote, as presence not content: the instructor opens
        // the case to read it.
        has_interpretation: hasInterpretation,
        has_assumptions: !!String(r.assumptions ?? '').trim(),
        lessons_total: LESSONS.length,
        lessons_answered: answered,
        prediction_made: !!state.prediction,
        is_final: !!r.is_final,
        finalized_at: r.finalized_at ?? null,
        updated_at: r.updated_at ?? r.created_at ?? null,
        // E07: "copied 2 days ago", and the line under a case's name.
        created_at: r.created_at ?? null,
        description: r.description ?? null,
        // The list screens (E07, E07b, E10): where the case is, its latest run.
        copied_from: r.parent_case_id != null && listed.has(Number(r.parent_case_id)) ? Number(r.parent_case_id) : null,
        flows_missing_amount: Number(r.flows_missing_amount ?? 0),
        stage: pipelineStage({
          completedRuns: Number(r.completed_runs ?? 0),
          hasInterpretation,
          isFinal: !!r.is_final,
        }),
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

    return NextResponse.json({
      success: true,
      members_see_own_cases: Number(project.members_see_own_cases) === 1,
      cases,
    });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Project progress error:', error);
    return NextResponse.json({ error: 'Failed to load progress' }, { status: 500 });
  }
}
