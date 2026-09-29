import { NextRequest, NextResponse } from 'next/server';
import { query, insert, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';

// GET /api/projects - Get all projects for authenticated user
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    const projects = await query(
      `SELECT p.project_id, p.project_name, p.description, p.owner_id,
              p.created_at, p.updated_at,
              a.username as owner_username,
              pm.permission_id,
              perm.permission_name,
              COUNT(DISTINCT c.case_id) as case_count,
              COUNT(DISTINCT comp.component_id) as component_count
       FROM project p
       LEFT JOIN project_members pm ON p.project_id = pm.project_id AND pm.user_id = ?
       LEFT JOIN permissions perm ON pm.permission_id = perm.permission_id
       LEFT JOIN account a ON p.owner_id = a.id
       LEFT JOIN case_table c ON p.project_id = c.project_id
       LEFT JOIN component comp ON comp.case_id = c.case_id
       WHERE p.owner_id = ? OR pm.user_id = ?
       GROUP BY p.project_id, p.project_name, p.description, p.owner_id,
                p.created_at, p.updated_at, a.username, pm.permission_id, perm.permission_name
       ORDER BY p.updated_at DESC`,
      [userId, userId, userId]
    );

    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
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
    const { project_name, description } = await request.json();

    if (!project_name || !String(project_name).trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

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
    if (error.message === 'Unauthorized' || error.message === 'No authentication token provided' || error.message === 'Invalid or expired token' || error.message === 'User account not found or inactive') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create project error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
