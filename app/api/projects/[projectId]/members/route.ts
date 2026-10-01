import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { query, queryOne, insert, execute } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';
import { casesRestrictedFor, isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';

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
 *
 * Who may do what: any member reads the list; the owner and project admins add,
 * change and remove viewers and editors; only the owner grants or revokes the
 * admin role (REC L9). A non-member gets 404, as for a missing project.
 */

const ROLES = ['viewer', 'editor', 'admin'] as const;
type Role = (typeof ROLES)[number];
/** Roles only the owner may grant, change or remove. */
const OWNER_MANAGED = new Set(['admin', 'owner']);

/** The person's role row on the project, or null when they are not a member. */
async function memberRow(projectId: number, userId: number) {
  return queryOne<any>(
    `SELECT pm.member_id, perm.permission_name
       FROM project_members pm
       LEFT JOIN permissions perm ON pm.permission_id = perm.permission_id
      WHERE pm.project_id = ? AND pm.user_id = ?`,
    [projectId, userId],
  );
}

async function guard(request: NextRequest, projectIdParam: string, need: 'viewer' | 'admin') {
  const userId = await requireAuth(request);
  const projectId = parseId(projectIdParam);
  const project = await queryOne<any>('SELECT owner_id FROM project WHERE project_id = ?', [projectId]);
  if (!project) return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };

  const isOwner = project.owner_id === userId;
  const denied = isOwner
    ? null
    : await projectAccessDenied(userId, projectId, need === 'admin' ? 'admin' : 'viewer', {
        notFound: 'Project not found',
      });
  if (denied) return { error: denied };

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
    const all = await query<any>(
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

    // When members see only their own cases (a class project), they also see
    // only the teaching staff and themselves here, not every classmate's name
    // and email. The owner and admins still see everyone.
    const members = (await casesRestrictedFor(g.userId, g.projectId))
      ? all.filter((m: any) => Number(m.user_id) === g.userId || ['owner', 'admin'].includes(m.permission_name))
      : all;

    const canManage = g.isOwner || (await checkProjectAccess(g.userId, g.projectId, 'admin'));
    return NextResponse.json({ success: true, owner, members, canManage, canManageAdmins: g.isOwner });
  } catch (error: any) {
    if (isAuthError(error)) {
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

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;
    const email = String(body?.email ?? '').trim().toLowerCase();
    const role = (String(body?.role ?? 'viewer').toLowerCase() as Role);

    if (!email) return NextResponse.json({ error: 'An email address is required' }, { status: 400 });
    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: `Role must be one of: ${ROLES.join(', ')}` }, { status: 400 });
    }
    if (OWNER_MANAGED.has(role) && !g.isOwner) {
      return NextResponse.json({ error: 'Only the project owner can grant the admin role' }, { status: 403 });
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

    const existing = await memberRow(g.projectId, person.id);
    if (existing && OWNER_MANAGED.has(existing.permission_name) && !g.isOwner) {
      return NextResponse.json({ error: 'Only the project owner can change an admin' }, { status: 403 });
    }

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
    if (isAuthError(error)) {
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

    const raw = new URL(request.url).searchParams.get('user_id');
    if (!raw || !/^\d+$/.test(raw)) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    const userId = parseInt(raw);

    const target = await memberRow(g.projectId, userId);
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (OWNER_MANAGED.has(target.permission_name) && !g.isOwner) {
      return NextResponse.json({ error: 'Only the project owner can remove an admin' }, { status: 403 });
    }

    await execute('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [g.projectId, userId]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Failed to remove that person' }, { status: 500 });
  }
}
