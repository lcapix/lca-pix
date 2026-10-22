/**
 * F14. Members and roles: add, change, remove; owner-only admin grants; a
 * removed member loses access (404) on the next request.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql } from '../support/db';
import { createProject } from '../support/world';
import { createUser, type TestUser } from '../support/users';

let owner: TestUser;
let admin: TestUser;
let alice: TestUser;
let bob: TestUser;
let pid: number;
beforeAll(async () => {
  [owner, admin, alice, bob] = await Promise.all(['f14owner', 'f14admin', 'f14alice', 'f14bob'].map((l) => createUser(l)));
  pid = await createProject(owner, `Shared study ${owner.id}`);
});

const roleOf = async (userId: number) =>
  (
    await sql(
      `SELECT p.permission_name FROM project_members pm JOIN permissions p ON p.permission_id = pm.permission_id WHERE pm.project_id = ? AND pm.user_id = ?`,
      [pid, userId],
    )
  )[0]?.permission_name ?? null;

describe('F14 members and roles', () => {
  it('F14.1-F14.4 the owner adds an admin and a viewer; the member list and flags follow', async () => {
    const add = await api.post(`/api/projects/${pid}/members`, { token: owner.token, json: { email: admin.email.toUpperCase(), role: 'admin' } });
    expect(add.status).toBe(200);
    expect(add.json).toMatchObject({ updated: false, member: { user_id: admin.id, permission_name: 'admin' } });
    expect((await api.post(`/api/projects/${pid}/members`, { token: owner.token, json: { email: alice.email, role: 'viewer' } })).status).toBe(200);

    const list = await api.get(`/api/projects/${pid}/members`, { token: owner.token });
    expect(list.json.owner).toMatchObject({ user_id: owner.id, email: owner.email });
    // The owner is listed once, as the owner, not again as a member.
    expect(list.json.members.map((m: any) => [m.user_id, m.permission_name])).toEqual([
      [admin.id, 'admin'],
      [alice.id, 'viewer'],
    ]);
    expect(list.json).toMatchObject({ canManage: true, canManageAdmins: true });

    const asAdmin = await api.get(`/api/projects/${pid}/members`, { token: admin.token });
    expect(asAdmin.json).toMatchObject({ canManage: true, canManageAdmins: false });
    const asViewer = await api.get(`/api/projects/${pid}/members`, { token: alice.token });
    expect(asViewer.json).toMatchObject({ canManage: false, canManageAdmins: false });

    // F14.4 the shared project shows up in the member's list.
    const home = await api.get('/api/projects', { token: alice.token });
    expect(home.json.projects.find((p: any) => p.project_id === pid)).toMatchObject({ permission_name: 'viewer' });
  });

  it('an admin member manages viewers and editors, but never the admin role (owner-only, L9 closed)', async () => {
    const t = admin.token;
    const promote = await api.post(`/api/projects/${pid}/members`, { token: t, json: { email: alice.email, role: 'editor' } });
    expect(promote.status).toBe(200);
    expect(promote.json.updated).toBe(true);
    expect(await roleOf(alice.id)).toBe('editor');

    const grant = await api.post(`/api/projects/${pid}/members`, { token: t, json: { email: bob.email, role: 'admin' } });
    expect(grant.status).toBe(403);
    expect(grant.json.error).toBe('Only the project owner can grant the admin role');
    expect(await roleOf(bob.id)).toBeNull();

    // Adding bob as an editor is fine; demoting or removing the other admin is not.
    expect((await api.post(`/api/projects/${pid}/members`, { token: t, json: { email: bob.email, role: 'editor' } })).status).toBe(200);
    await api.post(`/api/projects/${pid}/members`, { token: owner.token, json: { email: bob.email, role: 'admin' } });
    const demote = await api.post(`/api/projects/${pid}/members`, { token: t, json: { email: bob.email, role: 'viewer' } });
    expect(demote.status).toBe(403);
    expect(demote.json.error).toBe('Only the project owner can change an admin');
    const remove = await api.delete(`/api/projects/${pid}/members?user_id=${bob.id}`, { token: t });
    expect(remove.status).toBe(403);
    expect(await roleOf(bob.id)).toBe('admin');
    // The owner can.
    expect((await api.delete(`/api/projects/${pid}/members?user_id=${bob.id}`, { token: owner.token })).status).toBe(200);
  });

  it('F14.3 a removed member gets 404 on the next request', async () => {
    expect((await api.get(`/api/projects/${pid}`, { token: alice.token })).status).toBe(200);
    const res = await api.delete(`/api/projects/${pid}/members?user_id=${alice.id}`, { token: admin.token });
    expect(res.status).toBe(200);
    const after = await api.get(`/api/projects/${pid}`, { token: alice.token });
    expect(after.status).toBe(404);
    expect(after.json).toEqual({ error: 'Project not found' });
    expect((await api.get('/api/projects', { token: alice.token })).json.projects.map((p: any) => p.project_id)).not.toContain(pid);
  });

  it('errors: unknown email 404, the owner 409, bad role or no email 400, missing user_id 400', async () => {
    const t = owner.token;
    const unknown = await api.post(`/api/projects/${pid}/members`, { token: t, json: { email: 'nobody@nowhere.test', role: 'viewer' } });
    expect(unknown.status).toBe(404);
    expect(unknown.json.error).toMatch(/^No account with that email/);
    expect((await api.post(`/api/projects/${pid}/members`, { token: t, json: { email: owner.email, role: 'viewer' } })).status).toBe(409);
    for (const json of [{ email: '', role: 'viewer' }, { email: bob.email, role: 'owner' }, { email: bob.email, role: 'superuser' }]) {
      const r = await api.post(`/api/projects/${pid}/members`, { token: t, json });
      expect([400, 403], JSON.stringify(json)).toContain(r.status);
      expect(await roleOf(bob.id)).toBeNull();
    }
    for (const q of ['', '?user_id=', '?user_id=abc', `?user_id=${bob.id}%20OR%201=1`]) {
      expect((await api.delete(`/api/projects/${pid}/members${q}`, { token: t })).status, q).toBe(400);
    }
  });

  it('a class list (E08): each email added, changed, already here, or with no account; a member who can read cannot add; full names come back', async () => {
    const carol = await createUser('f14carol', { fullName: 'Carol Diaz' });
    const dan = await createUser('f14dan', { fullName: 'Dan Ito' });
    // Carol is here already as a viewer; Dan is new; one address has no account; one is the owner.
    await api.post(`/api/projects/${pid}/members`, { token: owner.token, json: { email: carol.email, role: 'viewer' } });
    const res = await api.post(`/api/projects/${pid}/members`, {
      token: owner.token,
      json: { emails: [carol.email, dan.email.toUpperCase(), `nobody.${Date.now()}@example.test`, owner.email, 'not-an-email', dan.email], role: 'editor' },
    });
    expect(res.status, res.text).toBe(200);
    expect(res.json.summary).toEqual({ added: 1, changed: 1, unchanged: 0, no_account: 1, other: 2, limited: 0 });
    expect(res.json.results.map((r: any) => r.outcome)).toEqual(['changed', 'added', 'no_account', 'owner', 'invalid']);
    expect(await roleOf(dan.id)).toBe('editor');
    expect(await roleOf(carol.id)).toBe('editor');
    // Sent again, nothing changes.
    const again = await api.post(`/api/projects/${pid}/members`, { token: owner.token, json: { emails: [dan.email], role: 'editor' } });
    expect(again.json.summary.unchanged).toBe(1);
    // The list carries full names.
    const list = await api.get(`/api/projects/${pid}/members`, { token: owner.token });
    expect(list.json.members.find((m: any) => m.user_id === dan.id).full_name).toBe('Dan Ito');
    // Too many at once, or none, is refused; someone who can only read cannot add.
    const many = Array.from({ length: 101 }, (_, i) => `x${i}@example.test`);
    expect((await api.post(`/api/projects/${pid}/members`, { token: owner.token, json: { emails: many, role: 'viewer' } })).status).toBe(400);
    expect((await api.post(`/api/projects/${pid}/members`, { token: owner.token, json: { emails: [], role: 'viewer' } })).status).toBe(400);
    expect((await api.post(`/api/projects/${pid}/members`, { token: dan.token, json: { emails: [bob.email], role: 'viewer' } })).status).toBe(403);
  });
});
