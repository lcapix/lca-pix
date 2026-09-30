/**
 * Mass assignment: fields a client must not set (ownership, parentage,
 * account type, ids) are ignored by every create and update route that
 * takes a JSON body.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

const SNEAKY = (w: World) => ({
  owner_id: w.users.userB.id,
  project_id: w.Q.id,
  case_id: w.Q.caseId,
  component_id: w.Q.component,
  created_by: w.users.userB.id,
  account_type: 'admin',
  is_active: 0,
  id: w.users.userB.id,
  user_id: w.users.userB.id,
  permission_id: 1,
  hierarchy_level: 99,
  is_template: 1,
  created_at: '2000-01-01 00:00:00',
});

describe('mass assignment', () => {
  it('PUT /api/projects/:id ignores owner_id, project_id, is_template, created_at', async () => {
    const res = await api.put(`/api/projects/${w.P.id}`, { token: w.users.owner.token, json: { ...SNEAKY(w), description: 'legit' } });
    expect(res.status).toBe(200);
    const row = await sqlOne('SELECT project_id, owner_id, is_template, description, created_at FROM project WHERE project_id = ?', [w.P.id]);
    expect(row).toMatchObject({ project_id: w.P.id, owner_id: w.users.owner.id, is_template: 0, description: 'legit' });
    expect(String(row.created_at)).not.toContain('2000');
    expect((await sqlOne('SELECT owner_id FROM project WHERE project_id = ?', [w.Q.id])).owner_id).toBe(w.users.userB.id);
  });

  it('an admin member cannot make themselves owner through PUT project', async () => {
    const res = await api.put(`/api/projects/${w.P.id}`, { token: w.users.adminm.token, json: { owner_id: w.users.adminm.id } });
    expect(res.status).toBe(200);
    expect((await sqlOne('SELECT owner_id FROM project WHERE project_id = ?', [w.P.id])).owner_id).toBe(w.users.owner.id);
    expect((await api.delete(`/api/projects/${w.P.id}`, { token: w.users.adminm.token })).status).toBe(403);
  });

  it('POST /api/projects: the owner is always the caller', async () => {
    const res = await api.post('/api/projects', { token: w.users.nonmem.token, json: { project_name: `Mine ${w.tag}`, ...SNEAKY(w) } });
    expect(res.status).toBe(201);
    expect(res.json.project).toMatchObject({ owner_id: w.users.nonmem.id, is_template: 0 });
  });

  it('PUT /api/cases/:id ignores project_id and case_id', async () => {
    const res = await api.put(`/api/cases/${w.P.base.id}`, { token: w.users.editor.token, json: { ...SNEAKY(w), description: 'legit case' } });
    expect(res.status).toBe(200);
    expect(await sqlOne('SELECT case_id, project_id FROM case_table WHERE case_id = ?', [w.P.base.id])).toEqual({ case_id: w.P.base.id, project_id: w.P.id });
  });

  it('POST /api/projects/:id/cases uses the path project, not a body project_id', async () => {
    const res = await api.post(`/api/projects/${w.P.id}/cases`, { token: w.users.editor.token, json: { case_name: `Sneak ${w.tag}`, case_type: 'comparative', ...SNEAKY(w) } });
    expect(res.status).toBe(201);
    expect(res.json.case.project_id).toBe(w.P.id);
    expect(await sql('SELECT case_id FROM case_table WHERE project_id = ? AND case_name = ?', [w.Q.id, `Sneak ${w.tag}`])).toEqual([]);
  });

  it('POST and PUT components ignore case_id, component_id, hierarchy_level from the body', async () => {
    const created = await api.post(`/api/cases/${w.P.base.id}/components`, {
      token: w.users.editor.token,
      json: { component_name: 'Sneaky step', component_type: 'operation', parent_component_id: w.P.base.subprocess, ...SNEAKY(w) },
    });
    expect(created.status, created.text).toBe(201);
    expect(created.json.component).toMatchObject({ case_id: w.P.base.id, hierarchy_level: 4, parent_component_id: w.P.base.subprocess });
    const id = created.json.component.component_id;
    const put = await api.put(`/api/components/${id}`, { token: w.users.editor.token, json: { ...SNEAKY(w), component_name: 'Still mine' } });
    expect(put.status).toBe(200);
    expect(await sqlOne('SELECT case_id, hierarchy_level, component_name FROM component WHERE component_id = ?', [id])).toEqual({
      case_id: w.P.base.id,
      hierarchy_level: 4,
      component_name: 'Still mine',
    });
    expect((await sqlOne('SELECT case_id FROM component WHERE component_id = ?', [w.Q.component])).case_id).toBe(w.Q.caseId);
  });

  it('POST and PUT flows ignore component_id and flow_id from the body', async () => {
    const created = await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: w.users.editor.token,
      json: { substance_id: w.substances.electricity, flow_type: 'input', quantity: 1, unit: 'kWh', flow_id: w.Q.flow, ...SNEAKY(w) },
    });
    expect(created.status).toBe(201);
    expect(created.json.flow.component_id).toBe(w.P.base.task);
    const put = await api.put(`/api/flows/${created.json.flow.flow_id}`, {
      token: w.users.editor.token,
      json: { quantity: 2, component_id: w.Q.component, flow_id: w.Q.flow },
    });
    expect(put.status).toBe(200);
    expect(put.json.flow.component_id).toBe(w.P.base.task);
    expect(Number((await sqlOne('SELECT quantity FROM flows WHERE flow_id = ?', [w.Q.flow])).quantity)).toBe(3);
  });

  it('PUT /api/auth/profile ignores account_type, is_active, email and id', async () => {
    const res = await api.put('/api/auth/profile', { token: w.users.nonmem.token, json: { fullName: 'N', company: 'C', ...SNEAKY(w), email: 'owned@x.test' } });
    expect(res.status).toBe(200);
    expect(await sqlOne('SELECT account_type, is_active, email FROM account WHERE id = ?', [w.users.nonmem.id])).toEqual({
      account_type: 'user',
      is_active: 1,
      email: w.users.nonmem.email,
    });
    expect((await sqlOne('SELECT full_name FROM account WHERE id = ?', [w.users.userB.id])).full_name).not.toBe('N');
  });

  it('POST /api/projects/:id/members: the role comes from `role` only, never permission_id or user_id', async () => {
    const res = await api.post(`/api/projects/${w.P.id}/members`, {
      token: w.users.adminm.token,
      json: { email: w.users.invitee.email, role: 'viewer', permission_id: 1, permission_name: 'owner', user_id: w.users.userB.id },
    });
    expect(res.status).toBe(200);
    const row = await sqlOne(
      `SELECT p.permission_name FROM project_members pm JOIN permissions p ON p.permission_id = pm.permission_id WHERE pm.project_id = ? AND pm.user_id = ?`,
      [w.P.id, w.users.invitee.id],
    );
    expect(row.permission_name).toBe('viewer');
    expect(await sql('SELECT member_id FROM project_members WHERE project_id = ? AND user_id = ?', [w.P.id, w.users.userB.id])).toEqual([]);
  });

  it('POST /api/substances: is_custom and created_by are set by the server', async () => {
    const res = await api.post('/api/substances', {
      token: w.users.nonmem.token,
      json: { name: `Mass ${w.tag}`, kind: 'input', unit: 'kg', method: 'CML 2001', impactCategory: 'Global Warming', factorValue: 1, source: 'Supplier EPD', is_custom: 0, created_by: w.users.userB.id },
    });
    expect(res.status).toBe(201);
    expect(res.json.substance).toMatchObject({ is_custom: 1, created_by: w.users.nonmem.id });
  });
});
