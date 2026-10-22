import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { query, queryOne, execute } from '@/lib/db-helpers';
import { getProjectRole, requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { canonicalizeRegion } from '@/lib/factor-selection';
import { parseId } from '@/lib/ids';
import { COLUMN_LIMITS, firstLengthError } from '@/lib/field-limits';
import { recordAudit } from '@/lib/audit';

/** The project's TINYINT(1) flags as booleans, where the columns exist. */
function withFlags(project: any) {
  if (!project) return project;
  const out = { ...project };
  for (const flag of ['ai_enabled']) {
    if (Object.prototype.hasOwnProperty.call(project, flag)) out[flag] = Number(project[flag]) === 1;
  }
  return out;
}

/** true/false/1/0 -> 1/0; anything else -> null (400). */
function parseFlag(v: unknown): 0 | 1 | null {
  if (v === true || v === 1) return 1;
  if (v === false || v === 0) return 0;
  return null;
}

// GET /api/projects/[projectId] - Get single project details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseId(projectIdParam);

    const denied = await projectAccessDenied(userId, projectId, undefined, { notFound: 'Project not found' });
    if (denied) return denied;

    const project = await queryOne(
      `SELECT p.*, a.username as owner_username 
       FROM project p 
       LEFT JOIN account a ON p.owner_id = a.id 
       WHERE p.project_id = ?`,
      [projectId]
    );

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get project members. Isolated in its own try/catch so the collaborators
    // sub-query can never 500 the whole project fetch — core project data must
    // always load even if the members/permissions schema is unavailable or
    // drifts. Falls back to an empty members list.
    let members: unknown[] = [];
    try {
      members = await query(
        `SELECT pm.member_id as member_id, pm.user_id, pm.added_at,
                a.username, a.email,
                perm.permission_name
         FROM project_members pm
         LEFT JOIN account a ON pm.user_id = a.id
         LEFT JOIN permissions perm ON pm.permission_id = perm.permission_id
         WHERE pm.project_id = ?`,
        [projectId]
      );
    } catch (memberErr) {
      console.warn('[project GET] members sub-query failed, returning empty list:', memberErr);
      members = [];
    }

    // The caller's own role, so the client can hide what this member cannot do.
    const my_role = await getProjectRole(userId, projectId);

    return NextResponse.json({ success: true, project: { ...withFlags(project), members, my_role } });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get project error:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PUT /api/projects/[projectId] - Update project
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseId(projectIdParam);

    const denied = await projectAccessDenied(userId, projectId, 'admin', { notFound: 'Project not found' });
    if (denied) return denied;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;
    const { project_name, description } = body;

    // Validate every field before the first write, so a refused field never
    // leaves the ones before it saved. Strings must fit their columns (MySQL
    // strict mode refuses a longer one, which used to surface as a 500 or as
    // the "needs migrate-014" 409 below).
    const P = COLUMN_LIMITS.project;
    if (body.region_code != null && typeof body.region_code !== 'string') {
      return NextResponse.json({ error: 'region_code must be text' }, { status: 400 });
    }
    const tooLong = firstLengthError([
      ['Project name', project_name, P.project_name],
      ['Description', description, P.description],
      ['Goal statement', body.goal_statement, P.goal_statement],
      ['Functional unit', body.functional_unit, P.functional_unit],
      ['Boundary notes', body.boundary_notes, P.boundary_notes],
      ['Region', body.region_code ? canonicalizeRegion(body.region_code) : null, P.region_code],
    ]);
    if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 });
    const boundary = body.system_boundary ?? null;
    if (boundary !== null && !['cradle-to-gate', 'gate-to-gate', 'cradle-to-grave'].includes(boundary)) {
      return NextResponse.json(
        { error: 'system_boundary must be cradle-to-gate, gate-to-gate or cradle-to-grave' },
        { status: 400 }
      );
    }
    const METHODS = ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'];
    if (body.lcia_method != null && !METHODS.includes(body.lcia_method)) {
      return NextResponse.json({ error: `lcia_method must be one of: ${METHODS.join(', ')}` }, { status: 400 });
    }
    // The AI switch (D7, migrate-042): the owner's alone, since it decides
    // whether the project's figures may be sent to the model at all.
    const aiEnabled = Object.prototype.hasOwnProperty.call(body ?? {}, 'ai_enabled')
      ? parseFlag(body.ai_enabled)
      : undefined;
    if (aiEnabled === null) {
      return NextResponse.json({ error: 'ai_enabled must be true or false' }, { status: 400 });
    }
    if (aiEnabled !== undefined) {
      const ownerDenied = await projectAccessDenied(userId, projectId, 'owner', { notFound: 'Project not found' });
      if (ownerDenied) return ownerDenied;
    }

    await execute(
      `UPDATE project
       SET project_name = COALESCE(?, project_name),
           description = COALESCE(?, description)
       WHERE project_id = ?`,
      [project_name ?? null, description ?? null, projectId]
    );

    // ISO 14044 goal & scope (4.2) is study-level: every case in the project is
    // an alternative measured against the same functional unit and boundary.
    // Separate statement so an environment without migrate-014 can still
    // rename a project; it only runs when one of these fields was sent.
    const GOAL_FIELDS = ['goal_statement', 'functional_unit', 'system_boundary', 'boundary_notes'];
    if (GOAL_FIELDS.some((k) => Object.prototype.hasOwnProperty.call(body, k))) {
      try {
        await execute(
          `UPDATE project
           SET goal_statement = COALESCE(?, goal_statement),
               functional_unit = COALESCE(?, functional_unit),
               system_boundary = COALESCE(?, system_boundary),
               boundary_notes = COALESCE(?, boundary_notes)
           WHERE project_id = ?`,
          [
            body.goal_statement ?? null,
            body.functional_unit ?? null,
            boundary,
            body.boundary_notes ?? null,
            projectId,
          ]
        );
      } catch (isoErr) {
        console.warn('[project PUT] goal & scope columns missing (run migrate-014):', isoErr);
        return NextResponse.json(
          { error: 'Goal & scope fields are not available yet: the database needs migrate-014.' },
          { status: 409 }
        );
      }
    }

    // The study's impact method and region (ISO 14044 4.2.3: LCIA methodology
    // and geographical coverage are scope choices). Runs use them by default.
    if (['lcia_method', 'region_code'].some((k) => Object.prototype.hasOwnProperty.call(body, k))) {
      try {
        await execute(
          `UPDATE project
           SET lcia_method = COALESCE(?, lcia_method),
               region_code = COALESCE(?, region_code)
           WHERE project_id = ?`,
          [body.lcia_method ?? null, body.region_code ? canonicalizeRegion(body.region_code) : null, projectId]
        );
      } catch (scopeErr) {
        console.warn('[project PUT] method/region columns missing (run migrate-018):', scopeErr);
        return NextResponse.json(
          { error: 'Method and region are not available yet: the database needs migrate-018.' },
          { status: 409 }
        );
      }
    }

    if (aiEnabled !== undefined) {
      const before = await queryOne<any>(`SELECT * FROM project WHERE project_id = ?`, [projectId]);
      if (before && !Object.prototype.hasOwnProperty.call(before, 'ai_enabled')) {
        return NextResponse.json(
          { error: 'The AI switch needs migration 042 on this database. Nothing else was changed by it.' },
          { status: 409 },
        );
      }
      const was = Number(before?.ai_enabled ?? 1) === 1;
      if (was !== (aiEnabled === 1)) {
        await execute(`UPDATE project SET ai_enabled = ? WHERE project_id = ?`, [aiEnabled, projectId]);
        await recordAudit({
          userId,
          action: 'update',
          table: 'project',
          recordId: projectId,
          before: { ai_enabled: was },
          after: { ai_enabled: aiEnabled === 1 },
          request,
        });
      }
    }

    const updatedProject = await queryOne(
      `SELECT p.*, a.username as owner_username
       FROM project p 
       LEFT JOIN account a ON p.owner_id = a.id 
       WHERE p.project_id = ?`,
      [projectId]
    );

    return NextResponse.json({ success: true, project: withFlags(updatedProject) });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update project error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseId(projectIdParam);

    const denied = await projectAccessDenied(userId, projectId, 'owner', { notFound: 'Project not found', forbidden: 'Only project owner can delete' });
    if (denied) return denied;

    const gone = await queryOne<any>(`SELECT project_name, owner_id FROM project WHERE project_id = ?`, [projectId]);
    await execute(`DELETE FROM project WHERE project_id = ?`, [projectId]);
    await recordAudit({
      userId,
      action: 'delete',
      table: 'project',
      recordId: projectId,
      before: gone
        ? { project_name: gone.project_name, owner_id: gone.owner_id }
        : null,
      request,
    });

    return NextResponse.json({ success: true, message: 'Project deleted' });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
