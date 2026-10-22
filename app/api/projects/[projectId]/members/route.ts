import { NextRequest, NextResponse } from 'next/server';
import { readJson } from '@/lib/http';
import { query, queryOne, insert, execute } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';
import { casesRestrictedFor, isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';
import { recordAudit } from '@/lib/audit';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rate-limit';

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
      `SELECT pm.member_id, pm.user_id, pm.added_at, a.username, a.email, perm.permission_name,
              COALESCE(NULLIF(TRIM(a.full_name), ''), a.username) AS full_name
         FROM project_members pm
         LEFT JOIN account a ON pm.user_id = a.id
         LEFT JOIN permissions perm ON pm.permission_id = perm.permission_id
         JOIN project p ON p.project_id = pm.project_id
        WHERE pm.project_id = ? AND pm.user_id <> p.owner_id
        ORDER BY pm.added_at, pm.member_id`,
      [g.projectId],
    );

    const owner = await queryOne<any>(
      `SELECT a.id AS user_id, a.username, a.email,
              COALESCE(NULLIF(TRIM(a.full_name), ''), a.username) AS full_name
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

type AddOutcome =
  | { outcome: 'added' | 'changed' | 'unchanged'; email: string; member: { user_id: number; username: string; email: string; full_name: string | null; permission_name: Role } }
  | { outcome: 'no_account' | 'owner' | 'invalid' | 'admin_only' | 'limited'; email: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The most emails one request may add (a class list); each counts against the lookup budget. */
const BULK_MAX = 100;

/**
 * Add one person by email, or change their access when they are here already.
 * Every email looked up counts against the caller's hourly lookup budget, so a
 * class list cannot probe which emails have accounts faster than one by one.
 */
async function addOne(
  g: { userId: number; projectId: number; isOwner: boolean },
  email: string,
  role: Role,
  permissionId: number,
  ownerId: number,
  request: NextRequest,
): Promise<AddOutcome> {
  if (!EMAIL_RE.test(email)) return { outcome: 'invalid', email };
  if (await enforceRateLimit(RATE_LIMITS.memberLookups, [g.userId])) return { outcome: 'limited', email };
  const person = await queryOne<any>(
    `SELECT id, username, email, COALESCE(NULLIF(TRIM(full_name), ''), username) AS full_name
       FROM account WHERE LOWER(email) = ? LIMIT 1`,
    [email],
  );
  if (!person) return { outcome: 'no_account', email };
  if (ownerId === person.id) return { outcome: 'owner', email };
  const existing = await memberRow(g.projectId, person.id);
  if (existing && OWNER_MANAGED.has(existing.permission_name) && !g.isOwner) return { outcome: 'admin_only', email };
  const member = { user_id: Number(person.id), username: person.username, email: person.email, full_name: person.full_name ?? null, permission_name: role };
  if (existing) {
    if (existing.permission_name === role) return { outcome: 'unchanged', email, member };
    await execute('UPDATE project_members SET permission_id = ? WHERE member_id = ?', [permissionId, existing.member_id]);
    await recordAudit({
      userId: g.userId,
      action: 'update',
      table: 'project_members',
      recordId: existing.member_id,
      before: { project_id: g.projectId, user_id: person.id, role: existing.permission_name },
      after: { project_id: g.projectId, user_id: person.id, role },
      request,
    });
    return { outcome: 'changed', email, member };
  }
  const memberId = await insert('INSERT INTO project_members (project_id, user_id, permission_id) VALUES (?, ?, ?)', [
    g.projectId,
    person.id,
    permissionId,
  ]);
  await recordAudit({
    userId: g.userId,
    action: 'create',
    table: 'project_members',
    recordId: Number(memberId) || 0,
    after: { project_id: g.projectId, user_id: person.id, role },
    request,
  });
  return { outcome: 'added', email, member };
}

// POST /api/projects/[projectId]/members
//   { email, role }       add one person (or change their access)
//   { emails: [], role }  add a class list (E08): what happened to each email
export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId: p } = await params;
    const g = await guard(request, p, 'admin');
    if (g.error) return g.error;

    const json = await readJson(request);
    if (!json.ok) return json.response;
    const body = json.body;
    const role = (String(body?.role ?? 'viewer').toLowerCase() as Role);
    const bulk = Array.isArray(body?.emails);
    const emails: string[] = bulk
      ? [...new Set((body.emails as unknown[]).map((e) => String(e ?? '').trim().toLowerCase()).filter(Boolean))]
      : [String(body?.email ?? '').trim().toLowerCase()].filter(Boolean);

    if (!emails.length) return NextResponse.json({ error: bulk ? 'emails: at least one address' : 'An email address is required' }, { status: 400 });
    if (emails.length > BULK_MAX) return NextResponse.json({ error: `emails: at most ${BULK_MAX} at a time` }, { status: 400 });
    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: `Role must be one of: ${ROLES.join(', ')}` }, { status: 400 });
    }
    if (OWNER_MANAGED.has(role) && !g.isOwner) {
      return NextResponse.json({ error: 'Only the project owner can grant the admin role' }, { status: 403 });
    }
    const permission = await queryOne<any>('SELECT permission_id FROM permissions WHERE permission_name = ? LIMIT 1', [role]);
    if (!permission) {
      return NextResponse.json({ error: `This database has no '${role}' permission row.` }, { status: 500 });
    }
    const owner = await queryOne<any>('SELECT owner_id FROM project WHERE project_id = ?', [g.projectId]);

    const results: AddOutcome[] = [];
    for (const email of emails) results.push(await addOne(g, email, role, Number(permission.permission_id), Number(owner?.owner_id), request));

    if (bulk) {
      const count = (o: AddOutcome['outcome']) => results.filter((r) => r.outcome === o).length;
      return NextResponse.json({
        success: true,
        results,
        summary: {
          added: count('added'),
          changed: count('changed'),
          unchanged: count('unchanged'),
          no_account: count('no_account'),
          other: count('owner') + count('invalid') + count('admin_only') + count('limited'),
          limited: count('limited'),
        },
      });
    }

    // One email: the answers this route has always given.
    const r = results[0];
    if (r.outcome === 'invalid' || r.outcome === 'no_account') {
      return NextResponse.json(
        { error: 'No account with that email. They need to sign up first, then you can add them. No invitation is sent from here.' },
        { status: 404 },
      );
    }
    if (r.outcome === 'owner') return NextResponse.json({ error: 'That person owns this project already' }, { status: 409 });
    if (r.outcome === 'admin_only') return NextResponse.json({ error: 'Only the project owner can change an admin' }, { status: 403 });
    if (r.outcome === 'limited') {
      return NextResponse.json({ error: 'Too many people looked up this hour. Try again later.' }, { status: 429 });
    }
    return NextResponse.json({ success: true, member: 'member' in r ? r.member : null, updated: r.outcome !== 'added' });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Add member error:', error);
    return NextResponse.json({ error: 'Failed to add that person' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId: p } = await params;
    const g = await guard(request, p, 'admin');
    if (g.error) return g.error;

    const raw = new URL(request.url).searchParams.get('user_id');
    if (!raw || !/^\d+$/.test(raw)) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    const userId = parseId(raw);

    const target = await memberRow(g.projectId, userId);
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    if (OWNER_MANAGED.has(target.permission_name) && !g.isOwner) {
      return NextResponse.json({ error: 'Only the project owner can remove an admin' }, { status: 403 });
    }

    await execute('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [g.projectId, userId]);
    // Their pin on a project they no longer belong to goes too (migrate-041).
    try {
      await execute('DELETE FROM project_pins WHERE project_id = ? AND user_id = ?', [g.projectId, userId]);
    } catch (pinErr: any) {
      if (pinErr?.code !== 'ER_NO_SUCH_TABLE') throw pinErr;
    }
    await recordAudit({
      userId: g.userId,
      action: 'delete',
      table: 'project_members',
      recordId: Number(target.member_id) || 0,
      before: { project_id: g.projectId, user_id: userId, role: target.permission_name },
      request,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Failed to remove that person' }, { status: 500 });
  }
}
