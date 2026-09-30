import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '@/app/api/projects/[projectId]/members/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireAuth: vi.fn(),
  checkProjectAccess: vi.fn(),
}));
vi.mock('@/lib/db-helpers');

const OWNER = 1;
const ADMIN = 2; // a project admin, not the owner
const VIEWER = 3;
const STRANGER = 4;

// Who holds which project role (project 7).
const roles: Record<number, string> = { [ADMIN]: 'admin', [VIEWER]: 'viewer', 12: 'editor', 13: 'admin' };
const RANK: Record<string, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 };
const PEOPLE: Record<string, { id: number; username: string; email: string }> = {
  'ed@corp.com': { id: 12, username: 'ed', email: 'ed@corp.com' },
  'ad@corp.com': { id: 13, username: 'ad', email: 'ad@corp.com' },
  'new@corp.com': { id: 14, username: 'new', email: 'new@corp.com' },
};

function as(userId: number) {
  vi.mocked(auth.requireAuth).mockResolvedValue(userId);
}

const ctx = { params: Promise.resolve({ projectId: '7' }) } as any;
const req = (method: string, url = '/api/projects/7/members', body?: unknown) =>
  new NextRequest(`http://t${url}`, {
    method,
    headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  as(OWNER);
  vi.mocked(auth.checkProjectAccess).mockImplementation(async (userId, _projectId, level) => {
    if (userId === OWNER) return true;
    const role = roles[userId];
    if (!role) return false;
    return !level || RANK[role] >= RANK[level];
  });
  vi.mocked(db.queryOne).mockImplementation(async (sql: string, params?: any[]) => {
    if (/SELECT owner_id FROM project WHERE project_id/.test(sql)) return { owner_id: OWNER } as any;
    if (/FROM account WHERE LOWER\(email\)/.test(sql)) return (PEOPLE[params![0]] ?? null) as any;
    if (/SELECT permission_id FROM permissions/.test(sql)) return { permission_id: RANK[params![0]] } as any;
    if (/FROM project_members pm/.test(sql)) {
      const role = roles[params![1]];
      return role ? ({ member_id: 100 + params![1], permission_name: role } as any) : null;
    }
    if (/FROM project p JOIN account/.test(sql)) return { user_id: OWNER, username: 'owner', email: 'o@corp.com' } as any;
    return null;
  });
  vi.mocked(db.query).mockResolvedValue([] as any);
  vi.mocked(db.execute).mockResolvedValue(1 as any);
  vi.mocked(db.insert).mockResolvedValue(1 as any);
});

describe('project members: access', () => {
  it('401 for a deactivated account on every method', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new auth.AuthError('User account not found or inactive'));
    expect((await GET(req('GET'), ctx)).status).toBe(401);
    expect((await POST(req('POST', undefined, { email: 'ed@corp.com', role: 'viewer' }), ctx)).status).toBe(401);
    expect((await DELETE(req('DELETE', '/api/projects/7/members?user_id=12'), ctx)).status).toBe(401);
  });

  it('404 for a non-member, 403 for a viewer who tries to manage', async () => {
    as(STRANGER);
    expect((await GET(req('GET'), ctx)).status).toBe(404);
    as(VIEWER);
    expect((await GET(req('GET'), ctx)).status).toBe(200);
    expect((await POST(req('POST', undefined, { email: 'new@corp.com', role: 'viewer' }), ctx)).status).toBe(403);
  });

  it('tells an admin they can manage members, but only the owner can manage admins', async () => {
    as(ADMIN);
    expect(await (await GET(req('GET'), ctx)).json()).toMatchObject({ canManage: true, canManageAdmins: false });
    as(OWNER);
    expect(await (await GET(req('GET'), ctx)).json()).toMatchObject({ canManage: true, canManageAdmins: true });
    as(VIEWER);
    expect(await (await GET(req('GET'), ctx)).json()).toMatchObject({ canManage: false, canManageAdmins: false });
  });
});

describe('project members: only the owner grants or revokes the admin role', () => {
  it('an admin can add viewers and editors', async () => {
    as(ADMIN);
    expect((await POST(req('POST', undefined, { email: 'new@corp.com', role: 'editor' }), ctx)).status).toBe(200);
    expect(db.insert).toHaveBeenCalled();
  });

  it('an admin cannot grant admin (403), and nothing is written', async () => {
    as(ADMIN);
    const res = await POST(req('POST', undefined, { email: 'new@corp.com', role: 'admin' }), ctx);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/owner/i);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('an admin cannot demote another admin (403)', async () => {
    as(ADMIN);
    const res = await POST(req('POST', undefined, { email: 'ad@corp.com', role: 'viewer' }), ctx);
    expect(res.status).toBe(403);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('the owner can grant and revoke admin', async () => {
    expect((await POST(req('POST', undefined, { email: 'new@corp.com', role: 'admin' }), ctx)).status).toBe(200);
    expect((await POST(req('POST', undefined, { email: 'ad@corp.com', role: 'viewer' }), ctx)).status).toBe(200);
  });

  it('an admin cannot remove an admin (403); the owner can', async () => {
    as(ADMIN);
    expect((await DELETE(req('DELETE', '/api/projects/7/members?user_id=13'), ctx)).status).toBe(403);
    expect(db.execute).not.toHaveBeenCalled();
    as(OWNER);
    expect((await DELETE(req('DELETE', '/api/projects/7/members?user_id=13'), ctx)).status).toBe(200);
    expect(db.execute).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM project_members/), [7, 13]);
  });

  it('an admin can remove an editor', async () => {
    as(ADMIN);
    expect((await DELETE(req('DELETE', '/api/projects/7/members?user_id=12'), ctx)).status).toBe(200);
  });
});

describe('project members: DELETE', () => {
  it('404 when the person is not a member', async () => {
    const res = await DELETE(req('DELETE', '/api/projects/7/members?user_id=14'), ctx);
    expect(res.status).toBe(404);
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('400 without a numeric user_id', async () => {
    expect((await DELETE(req('DELETE'), ctx)).status).toBe(400);
    expect((await DELETE(req('DELETE', '/api/projects/7/members?user_id=abc'), ctx)).status).toBe(400);
  });
});
