import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, insert, execute } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';

/**
 * Who else can see a project.
 *
 * The database has had project_members and a permission hierarchy from the
 * start, with no way to use it: an instructor could not open a student's work
 * and a student could not hand anything in. This is that interface.
 *
 * An invitation is by email and the person must already have an account: we do
 * not send mail, and inviting into a void would be a promise the product does
 * not keep.
 */

const ROLES = ['viewer', 'editor', 'admin'] as const;
type Role = (typeof ROLES)[number];

async function guard(request: NextRequest, projectIdParam: string, need: 'viewer' | 'admin') {
  const userId = await requireAuth(request);
  const projectId = parseInt(projectIdParam);
  const project = await queryOne<any>('SELECT owner_id FROM project WHERE project_id = ?', [projectId]);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  const isOwner = project.owner_id === userId;
  const ok = isOwner || (await checkProjectAccess(userId, projectId, need === 'admin' ? 'admin' : 'viewer'));
  if (!ok) return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };

  return { userId, projectId, isOwner };
}

// GET /api/projects/[projectId]/members
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId: p } = await params;
    const g = await guard(request, p, 'viewer');
    if (g.error) return g.error;

    // The owner is listed once, as the owner. A project_members row for the
    // owner exists in older data and would otherwise show them twice, the
    // second time with a Remove button that does nothing useful.
    const members = await query<any>(
      `SELECT pm.member_id, pm.user_id, pm.added_at, a.username, a.email, perm.permission_name
         FROM project_members pm
         LEFT JOIN account a ON pm.user_id = a.id
         LEFT JOIN permissions perm ON pm.permission_id = perm.permission_id
         JOIN project p ON p.project_id = pm.project_id
        WHERE pm.project_id = ? AND pm.user_id <> p.owner_id
        ORDER BY pm.added_at, pm.member_id`,
      [g.projectId],
    );

    const owner = await queryOne<any>(
      `SELECT a.id AS user_id, a.username, a.email
         FROM project p JOIN account a ON a.id = p.owner_id
        WHERE p.project_id = ?`,
      [g.projectId],
    );

    return NextResponse.json({ success: true, owner, members, canManage: g.isOwner });
  } catch (error: any) {
    if (/Unauthorized|token/i.test(error?.message ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List members error:', error);
    return NextResponse.json({ error: 'Failed to load members' }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/members  { email, role }
export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId: p } = await params;
    const g = await guard(request, p, 'admin');
    if (g.error) return g.error;

    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const role = (String(body?.role ?? 'viewer').toLowerCase() as Role);

    if (!email) return NextResponse.json({ error: 'An email address is required' }, { status: 400 });
    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: `Role must be one of: ${ROLES.join(', ')}` }, { status: 400 });
    }

    const person = await queryOne<any>(
      'SELECT id, username, email FROM account WHERE LOWER(email) = ? LIMIT 1',
      [email],
    );
    if (!person) {
      return NextResponse.json(
        {
          error:
            'No account with that email. They need to sign up first, then you can add them — no invitation is sent from here.',
        },
        { status: 404 },
      );
    }

    const owner = await queryOne<any>('SELECT owner_id FROM project WHERE project_id = ?', [g.projectId]);
    if (owner?.owner_id === person.id) {
      return NextResponse.json({ error: 'That person owns this project already' }, { status: 409 });
    }

    const permission = await queryOne<any>(
      'SELECT permission_id FROM permissions WHERE permission_name = ? LIMIT 1',
      [role],
    );
    if (!permission) {
      return NextResponse.json(
        { error: `This database has no '${role}' permission row.` },
        { status: 500 },
      );
    }

    const existing = await queryOne<any>(
      'SELECT member_id FROM project_members WHERE project_id = ? AND user_id = ?',
      [g.projectId, person.id],
    );

    if (existing) {
      await execute('UPDATE project_members SET permission_id = ? WHERE member_id = ?', [
        permission.permission_id,
        existing.member_id,
      ]);
    } else {
      await insert(
        'INSERT INTO project_members (project_id, user_id, permission_id) VALUES (?, ?, ?)',
        [g.projectId, person.id, permission.permission_id],
      );
    }

    return NextResponse.json({
      success: true,
      member: { user_id: person.id, username: person.username, email: person.email, permission_name: role },
      updated: !!existing,
    });
  } catch (error: any) {
    if (/Unauthorized|token/i.test(error?.message ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Add member error:', error);
    return NextResponse.json({ error: 'Failed to add that person' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/members?user_id=12
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId: p } = await params;
    const g = await guard(request, p, 'admin');
    if (g.error) return g.error;

    const userId = new URL(request.url).searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

    await execute('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [
      g.projectId,
      parseInt(userId),
    ]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (/Unauthorized|token/i.test(error?.message ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Failed to remove that person' }, { status: 500 });
  }
}
