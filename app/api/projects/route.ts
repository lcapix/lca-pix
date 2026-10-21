import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { COLUMN_LIMITS, firstLengthError } from '@/lib/field-limits';
import { query, insert, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, REACHABLE_CASE_SQL, reachableCaseSql } from '@/lib/route-guard';
import { headlineOf } from '@/lib/summary/case-summary';
import { caseChangedAfterRun } from '@/lib/runs/stale';

// GET /api/projects - Get all projects for authenticated user
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    // The sample flag (migrate-038), held import lines (migrate-040) and the
    // caller's pins (migrate-041) are read when the database has them.
    const listSql = (withNew: boolean) =>
      `SELECT p.project_id, p.project_name, p.description, p.owner_id,
              p.created_at, p.updated_at,${withNew ? ' p.is_sample,' : ''}
              a.username as owner_username,
              COALESCE(NULLIF(TRIM(a.full_name), ''), a.username) AS owner_name,
              pm.permission_id,
              perm.permission_name,
              -- Counts over the cases the caller reaches only: in a project that
              -- keeps members' cases apart, a student's card counts their own (B-A1).
              (SELECT COUNT(*) FROM case_table c
                WHERE c.project_id = p.project_id AND ${REACHABLE_CASE_SQL}) AS case_count,
              (SELECT COUNT(*) FROM case_table c JOIN component comp ON comp.case_id = c.case_id
                WHERE c.project_id = p.project_id AND ${REACHABLE_CASE_SQL}) AS component_count,
              -- For the project lists (E12, E19): people, and the latest work
              -- the caller can see (their reachable cases only, B-A1).
              (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.project_id) AS member_count,
              -- People on it: the owner once, whether or not they hold a members row.
              1 + (SELECT COUNT(*) FROM project_members m2 WHERE m2.project_id = p.project_id AND m2.user_id <> p.owner_id) AS people,
              (SELECT MAX(c.updated_at) FROM case_table c
                WHERE c.project_id = p.project_id AND ${REACHABLE_CASE_SQL}) AS last_case_update,
              (SELECT MAX(ar.run_date)
                 FROM case_table c2
                 JOIN assessment_runs ar ON ar.case_id = c2.case_id AND ar.status = 'completed'
                WHERE c2.project_id = p.project_id AND ${reachableCaseSql('c2')}
              ) AS last_run_at,
              -- Home (E12): hand-ins, members' cases with no run yet, and the
              -- base case (the first one) with its latest completed run.
              (SELECT COUNT(*) FROM case_table c4
                WHERE c4.project_id = p.project_id AND c4.is_final = 1 AND ${reachableCaseSql('c4')}) AS hand_ins,
              (SELECT COUNT(*) FROM case_table c5
                WHERE c5.project_id = p.project_id AND c5.created_by <> p.owner_id AND ${reachableCaseSql('c5')}
                  AND NOT EXISTS (SELECT 1 FROM assessment_runs r5 WHERE r5.case_id = c5.case_id AND r5.status = 'completed')
              ) AS member_cases_without_run,
              (SELECT MIN(c6.case_id) FROM case_table c6
                WHERE c6.project_id = p.project_id AND c6.case_type = 'base' AND ${reachableCaseSql('c6')}) AS base_case_id,
              (SELECT r6.run_id FROM assessment_runs r6
                WHERE r6.status = 'completed'
                  AND r6.case_id = (SELECT MIN(c7.case_id) FROM case_table c7
                                     WHERE c7.project_id = p.project_id AND c7.case_type = 'base' AND ${reachableCaseSql('c7')})
                ORDER BY r6.run_date DESC, r6.run_id DESC LIMIT 1) AS base_run_id${
                withNew
                  ? `,
              (SELECT COUNT(*)
                 FROM case_table c3
                 JOIN import_held_lines h ON h.case_id = c3.case_id AND h.status = 'held'
                WHERE c3.project_id = p.project_id AND ${reachableCaseSql('c3')}
              ) AS held_lines,
              (SELECT h8.case_id FROM case_table c8
                 JOIN import_held_lines h8 ON h8.case_id = c8.case_id AND h8.status = 'held'
                WHERE c8.project_id = p.project_id AND ${reachableCaseSql('c8')}
                GROUP BY h8.case_id ORDER BY COUNT(*) DESC, h8.case_id LIMIT 1) AS held_case_id,
              (SELECT pp.pinned_at FROM project_pins pp WHERE pp.project_id = p.project_id AND pp.user_id = ?) AS pinned_at`
                  : ''
              }
       -- The caller's projects first, by index (every account has a sample, so
       -- the project table grows with sign-ups), then one row per project: the
       -- members join is unique per project and person, and every figure above
       -- is a subquery run once per project. (Joining cases and steps here and
       -- grouping ran each subquery once per joined step instead: 6 s for a
       -- class of 300 in stage 10.3.)
       FROM (SELECT o.project_id FROM project o WHERE o.owner_id = ?
             UNION
             SELECT mm.project_id FROM project_members mm WHERE mm.user_id = ?) mine
       JOIN project p ON p.project_id = mine.project_id
       LEFT JOIN project_members pm ON p.project_id = pm.project_id AND pm.user_id = ?
       LEFT JOIN permissions perm ON pm.permission_id = perm.permission_id
       LEFT JOIN account a ON p.owner_id = a.id
       ORDER BY p.updated_at DESC, p.project_id DESC`;
    // Every placeholder is the caller: count them from the SQL, so a new subquery cannot drift.
    const params = (withNew: boolean) => Array((listSql(withNew).match(/\?/g) ?? []).length).fill(userId);
    let projects: any[];
    try {
      projects = await query<any>(listSql(true), params(true));
    } catch (err: any) {
      if (err?.code !== 'ER_BAD_FIELD_ERROR' && err?.code !== 'ER_NO_SUCH_TABLE') throw err;
      projects = await query<any>(listSql(false), params(false));
    }
    for (const p of projects) {
      p.is_sample = Number(p.is_sample ?? 0) === 1;
      p.held_lines = Number(p.held_lines ?? 0);
      p.pinned = p.pinned_at != null;
      p.pinned_at = p.pinned_at ?? null;
      p.hand_ins = Number(p.hand_ins ?? 0);
      p.people = Number(p.people ?? 1);
      p.member_cases_without_run = Number(p.member_cases_without_run ?? 0);
    }
    await addHomeSummaries(projects, userId);

    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get projects error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);
    const json = await readJson(request);
    if (!json.ok) return json.response;
    const { project_name, description } = json.body;

    if (!project_name || !String(project_name).trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }
    const tooLong = firstLengthError([
      ['Project name', project_name, COLUMN_LIMITS.project.project_name],
      ['Description', description, COLUMN_LIMITS.project.description],
    ]);
    if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });

    // One name, one project. Two studies with the same name are impossible to
    // tell apart in the project list, in a comparison and in an export.
    const clash = await queryOne<any>(
      `SELECT project_id FROM project
        WHERE owner_id = ? AND LOWER(TRIM(project_name)) = LOWER(TRIM(?)) LIMIT 1`,
      [userId, project_name]
    );
    if (clash) {
      return NextResponse.json(
        { error: `You already have a project called "${String(project_name).trim()}". Pick another name.` },
        { status: 409 }
      );
    }

    const projectId = await insert(
      `INSERT INTO project (project_name, description, owner_id) VALUES (?, ?, ?)`,
      [project_name, description || null, userId]
    );

    // Automatically add owner to project_members with owner permission
    const ownerPermissionId = await queryOne<any>(
      `SELECT permission_id FROM permissions WHERE permission_name = 'owner'`
    );

    await insert(
      `INSERT INTO project_members (project_id, user_id, permission_id) VALUES (?, ?, ?)`,
      [projectId, userId, ownerPermissionId.permission_id]
    );

    const newProject = await queryOne(
      `SELECT p.*, a.username as owner_username 
       FROM project p 
       LEFT JOIN account a ON p.owner_id = a.id 
       WHERE p.project_id = ?`,
      [projectId]
    );

    return NextResponse.json({ success: true, project: newProject }, { status: 201 });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

/**
 * Home's per-project summary (E12), read in a few queries for the whole list:
 * the base case's latest result (its headline from the frozen totals), whether
 * that case changed after the run (for the people who run the project), and
 * the name of the case holding import lines.
 */
async function addHomeSummaries(projects: any[], userId: number) {
  const runIds = projects.map((p) => Number(p.base_run_id)).filter((id) => id > 0);
  const runs = new Map<number, any>();
  if (runIds.length) {
    const rows = await query<any>(
      `SELECT run_id, run_date,
              JSON_EXTRACT(run_snapshot, '$.totals') AS totals,
              JSON_EXTRACT(run_snapshot, '$.goal_scope.per_fu_scale') AS per_fu_scale
         FROM assessment_runs WHERE run_id IN (${runIds.map(() => '?').join(', ')})`,
      runIds,
    );
    for (const r of rows) runs.set(Number(r.run_id), r);
  }
  const heldIds = projects.map((p) => Number(p.held_case_id)).filter((id) => id > 0);
  const heldNames = new Map<number, string>();
  if (heldIds.length) {
    const rows = await query<any>(
      `SELECT case_id, case_name FROM case_table WHERE case_id IN (${heldIds.map(() => '?').join(', ')})`,
      heldIds,
    );
    for (const r of rows) heldNames.set(Number(r.case_id), r.case_name);
  }
  // The stale check reads the case; only for projects the caller runs, at most 20.
  let staleChecks = 0;
  for (const p of projects) {
    const run = runs.get(Number(p.base_run_id));
    p.base_case_id = p.base_case_id == null ? null : Number(p.base_case_id);
    p.base_run = run
      ? { run_id: Number(run.run_id), run_date: run.run_date, headline: headlineOf(run.totals, run.per_fu_scale) }
      : null;
    delete p.base_run_id;
    p.held_case = p.held_case_id ? { case_id: Number(p.held_case_id), case_name: heldNames.get(Number(p.held_case_id)) ?? null } : null;
    delete p.held_case_id;
    const runsIt = Number(p.owner_id) === userId || p.permission_name === 'owner' || p.permission_name === 'admin';
    p.base_changed_after_run = null;
    if (run && runsIt && !p.is_sample && p.base_case_id && staleChecks < 20) {
      staleChecks++;
      p.base_changed_after_run = await caseChangedAfterRun(p.base_case_id, Number(run.run_id));
    }
  }
}
