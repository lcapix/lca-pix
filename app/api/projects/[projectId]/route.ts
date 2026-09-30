import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { query, queryOne, execute } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { canonicalizeRegion } from '@/lib/factor-selection';
import { parseId } from '@/lib/ids';

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

    return NextResponse.json({ success: true, project: { ...project, members } });
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
      const boundary = body.system_boundary ?? null;
      if (
        boundary !== null &&
        !['cradle-to-gate', 'gate-to-gate', 'cradle-to-grave'].includes(boundary)
      ) {
        return NextResponse.json(
          { error: 'system_boundary must be cradle-to-gate, gate-to-gate or cradle-to-grave' },
          { status: 400 }
        );
      }
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
      const METHODS = ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'];
      if (body.lcia_method != null && !METHODS.includes(body.lcia_method)) {
        return NextResponse.json({ error: `lcia_method must be one of: ${METHODS.join(', ')}` }, { status: 400 });
      }
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

    const updatedProject = await queryOne(
      `SELECT p.*, a.username as owner_username
       FROM project p 
       LEFT JOIN account a ON p.owner_id = a.id 
       WHERE p.project_id = ?`,
      [projectId]
    );

    return NextResponse.json({ success: true, project: updatedProject });
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

    await execute(`DELETE FROM project WHERE project_id = ?`, [projectId]);

    return NextResponse.json({ success: true, message: 'Project deleted' });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
