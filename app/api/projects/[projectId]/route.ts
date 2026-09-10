import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

// GET /api/projects/[projectId] - Get single project details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const userId = await requireAuth(request);
    const { projectId: projectIdParam } = await params;
    const projectId = parseInt(projectIdParam);

    const hasAccess = await checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
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
    const projectId = parseInt(projectIdParam);

    const hasAccess = await checkProjectAccess(userId, projectId, 'admin');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { project_name, description } = await request.json();

    await execute(
      `UPDATE project
       SET project_name = COALESCE(?, project_name),
           description = COALESCE(?, description)
       WHERE project_id = ?`,
      [project_name ?? null, description ?? null, projectId]
    );

    const updatedProject = await queryOne(
      `SELECT p.*, a.username as owner_username 
       FROM project p 
       LEFT JOIN account a ON p.owner_id = a.id 
       WHERE p.project_id = ?`,
      [projectId]
    );

    return NextResponse.json({ success: true, project: updatedProject });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
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
    const projectId = parseInt(projectIdParam);

    const hasAccess = await checkProjectAccess(userId, projectId, 'owner');
    if (!hasAccess) {
      return NextResponse.json({ error: 'Only project owner can delete' }, { status: 403 });
    }

    await execute(`DELETE FROM project WHERE project_id = ?`, [projectId]);

    return NextResponse.json({ success: true, message: 'Project deleted' });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete project error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
