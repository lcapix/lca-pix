/**
 * F20. The audit trail and the caller's role.
 * - The privacy switch, adding, re-roling and removing a member, and deleting a
 *   case or a project each write one row to audit_log (who, what, before, after).
 * - GET project and GET case carry my_role, so the screens can hide what a
 *   "Can read" member cannot do; the server still refuses it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { addMember, createCase, createProject } from '../support/world';
import { createUser, type TestUser } from '../support/users';

let owner: TestUser;
let editor: TestUser;
let reader: TestUser;
let pid: number;
let caseId: number;

const auditRows = (table: string, recordId: number) =>
  sql<any>(
    `SELECT user_id, action_type, old_values, new_values FROM audit_log WHERE table_name = ? AND record_id = ? ORDER BY log_id`,
    [table, recordId],
  );
const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v);

beforeAll(async () => {
  [owner, editor, reader] = await Promise.all(['f20owner', 'f20editor', 'f20reader'].map((l) => createUser(l)));
  pid = await createProject(owner, `Audit ${owner.id}`, { functional_unit: '1 bracket', lcia_method: 'TRACI 2.1', region_code: 'US' });
  caseId = await createCase(owner, pid, 'Base case');
  await addMember(owner, pid, editor, 'editor');
  await addMember(owner, pid, reader, 'viewer');
});

describe('F20 the caller role on reads', () => {
  it('GET project and GET case say who the caller is in the project', async () => {
    const roleOf = async (u: TestUser) => ({
      project: (await api.get(`/api/projects/${pid}`, { token: u.token })).json?.project?.my_role,
      kase: (await api.get(`/api/cases/${caseId}`, { token: u.token })).json?.case?.my_role,
    });
    expect(await roleOf(owner)).toEqual({ project: 'owner', kase: 'owner' });
    expect(await roleOf(editor)).toEqual({ project: 'editor', kase: 'editor' });
    expect(await roleOf(reader)).toEqual({ project: 'viewer', kase: 'viewer' });
  });

  it('a "Can read" member is still refused a write by the server', async () => {
    const res = await api.put(`/api/cases/${caseId}`, { token: reader.token, json: { case_name: 'renamed' } });
    expect(res.status).toBe(403);
  });
});

describe('F20 the audit trail', () => {
  it('records the privacy switch once per change, with before and after', async () => {
    expect((await api.put(`/api/projects/${pid}`, { token: owner.token, json: { members_see_own_cases: true } })).status).toBe(200);
    // Saving the same value again is not a change and writes nothing.
    expect((await api.put(`/api/projects/${pid}`, { token: owner.token, json: { members_see_own_cases: true } })).status).toBe(200);
    const rows = (await auditRows('project', pid)).filter((r) => json(r.new_values)?.members_see_own_cases !== undefined);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: owner.id, action_type: 'update' });
    expect(json(rows[0].old_values)).toEqual({ members_see_own_cases: false });
    expect(json(rows[0].new_values)).toEqual({ members_see_own_cases: true });
  });

  it('records a role change and a removal', async () => {
    const member = await sqlOne<any>(`SELECT member_id FROM project_members WHERE project_id = ? AND user_id = ?`, [pid, reader.id]);
    expect((await api.post(`/api/projects/${pid}/members`, { token: owner.token, json: { email: reader.email, role: 'editor' } })).status).toBe(200);
    expect((await api.delete(`/api/projects/${pid}/members?user_id=${reader.id}`, { token: owner.token })).status).toBe(200);
    // The whole history of that membership: added in setup, re-roled, removed.
    const rows = await auditRows('project_members', member.member_id);
    expect(rows.map((r) => r.action_type)).toEqual(['create', 'update', 'delete']);
    expect(json(rows[0].new_values)).toMatchObject({ user_id: reader.id, role: 'viewer' });
    expect(json(rows[1].old_values)).toMatchObject({ role: 'viewer' });
    expect(json(rows[1].new_values)).toMatchObject({ role: 'editor' });
    expect(json(rows[2].old_values)).toMatchObject({ user_id: reader.id, role: 'editor' });
  });

  it('records deleting a case and a project', async () => {
    expect((await api.delete(`/api/cases/${caseId}`, { token: owner.token })).status).toBe(200);
    expect((await auditRows('case_table', caseId))[0]).toMatchObject({ user_id: owner.id, action_type: 'delete' });
    expect((await api.delete(`/api/projects/${pid}`, { token: owner.token })).status).toBe(200);
    const projectRows = await auditRows('project', pid);
    expect(projectRows[projectRows.length - 1]).toMatchObject({ action_type: 'delete' });
  });
});
