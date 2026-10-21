/**
 * F26. Per-case privacy with "members see only their own cases" on (D2,
 * migrate-037): what a student and an auditor read of the staff's cases, that
 * they can copy but never change them, and the per-case "keep from members".
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api, expectStatus } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { addMember, buildTree, buildWorld, createCase, createProject, type World } from '../support/world';

let w: World;
let pid: number;
let base: number;
let taCase: number;
let studentCase: number;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
  // A class: owner = instructor, adminm = TA, editor = student, viewer = auditor, revoked = classmate.
  const owner = w.users.owner;
  pid = await createProject(owner, `Class D2 ${w.tag}`);
  await addMember(owner, pid, w.users.adminm, 'admin');
  await addMember(owner, pid, w.users.editor, 'editor');
  await addMember(owner, pid, w.users.viewer, 'viewer');
  base = await createCase(owner, pid, `Base ${w.tag}`);
  await buildTree(owner, base, ['Bracket', 'Line', 'Cutting', 'Cut blank', 'Shear'].map((n) => `${n} ${w.tag}`));
  taCase = await createCase(w.users.adminm, pid, `TA worked answer ${w.tag}`);
  studentCase = await createCase(w.users.editor, pid, `Student ${w.tag}`);
  expectStatus(await api.put(`/api/projects/${pid}`, { token: owner.token, json: { members_see_own_cases: true } }), 200, 'switch on');
});

describe('F26 privacy D2', () => {
  it("an editor reads the owner's and admins' cases; a viewer only the owner's", async () => {
    const list = async (token: string) =>
      (await api.get(`/api/projects/${pid}/cases`, { token })).json.cases.map((c: any) => c.case_id).sort();
    expect(await list(w.users.editor.token)).toEqual([base, taCase, studentCase].sort());
    expect(await list(w.users.viewer.token)).toEqual([base]);
    expect((await api.get(`/api/cases/${taCase}`, { token: w.users.editor.token })).status).toBe(200);
    expect((await api.get(`/api/cases/${taCase}`, { token: w.users.viewer.token })).status).toBe(404);
  });

  it("a student never changes a staff case: edit, add a step, run, delete are 403 and write nothing", async () => {
    const t = w.users.editor.token;
    const comps = (await api.get(`/api/cases/${base}/components`, { token: t })).json.components;
    expect(comps.length).toBeGreaterThan(0);
    for (const [label, res] of [
      ['PUT case', await api.put(`/api/cases/${base}`, { token: t, json: { case_name: 'mine now' } })],
      ['add step', await api.post(`/api/cases/${base}/components`, { token: t, json: { component_name: 'x', component_type: 'operation', parent_component_id: comps[0].component_id } })],
      ['run', await api.post(`/api/cases/${base}/assessments`, { token: t, json: { calculation_method: 'CML 2001', region_code: 'US' } })],
      ['step costs', await api.put(`/api/components/${comps[0].component_id}/costs`, { token: t, json: { kind: 'overhead', mode: 'entered', amount: 1 } })],
      ['hide', await api.put(`/api/cases/${base}`, { token: t, json: { hidden_from_members: true } })],
    ] as const) {
      expect(res.status, label).toBe(403);
    }
    expect((await sqlOne('SELECT case_name FROM case_table WHERE case_id = ?', [base])).case_name).toBe(`Base ${w.tag}`);
  });

  it('"Make my own copy": the student duplicates the base case; the copy is theirs, editable, and classmates do not see it', async () => {
    const t = w.users.editor.token;
    const dup = await api.post(`/api/cases/${base}/duplicate`, { token: t, json: { case_name: `My copy ${w.tag}` } });
    expect(dup.status, dup.text).toBe(201);
    const row = await sqlOne<any>('SELECT created_by, hidden_from_members, parent_case_id FROM case_table WHERE case_id = ?', [dup.json.case_id]);
    expect(row).toEqual({ created_by: w.users.editor.id, hidden_from_members: 0, parent_case_id: base });
    expect((await api.put(`/api/cases/${dup.json.case_id}`, { token: t, json: { description: 'my change' } })).status).toBe(200);
    const got = await api.get(`/api/cases/${dup.json.case_id}`, { token: t });
    expect(got.json.case).toMatchObject({ my_role: 'editor', copied_from: { case_id: base, case_name: `Base ${w.tag}` } });
    // The auditor (viewer) does not reach a student's case.
    expect((await api.get(`/api/cases/${dup.json.case_id}`, { token: w.users.viewer.token })).status).toBe(404);
    // The auditor cannot make a copy at all (creating needs Can change).
    expect((await api.post(`/api/cases/${base}/duplicate`, { token: w.users.viewer.token, json: { case_name: `Auditor copy ${w.tag}` } })).status).toBe(403);
  });

  it('keep from members: owner and admins only, a strict boolean, audited once per change', async () => {
    const owner = w.users.owner.token;
    for (const bad of ['yes', 2, null]) {
      expect((await api.put(`/api/cases/${taCase}`, { token: owner, json: { hidden_from_members: bad } })).status, String(bad)).toBe(400);
    }
    expect((await api.put(`/api/cases/${taCase}`, { token: w.users.adminm.token, json: { hidden_from_members: true } })).status).toBe(200);
    expect((await api.put(`/api/cases/${taCase}`, { token: owner, json: { hidden_from_members: true } })).status).toBe(200); // no change
    expect((await api.get(`/api/cases/${taCase}`, { token: w.users.editor.token })).status).toBe(404);
    const audit = await sql<any>(
      `SELECT user_id, action_type, old_values, new_values FROM audit_log WHERE table_name = 'case_table' AND record_id = ? ORDER BY log_id`,
      [taCase],
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ user_id: w.users.adminm.id, action_type: 'update' });
    expect(JSON.parse(JSON.stringify(audit[0].new_values))).toMatchObject({ hidden_from_members: 1 });
  });

  it("clone-from: staff cloning a student's work into a staff case keeps that case from the class", async () => {
    const empty = await createCase(w.users.owner, pid, `Review copy ${w.tag}`, 'comparative');
    await buildTree(w.users.editor, studentCase, ['S product', 'S line', 'S sub', 'S op', 'S task'].map((n) => `${n} ${w.tag}`));
    expect((await api.get(`/api/cases/${empty}`, { token: w.users.editor.token })).status).toBe(200); // a staff case: readable
    const res = await api.post(`/api/cases/${empty}/clone-from`, { token: w.users.owner.token, json: { sourceCaseId: studentCase } });
    expect(res.status, res.text).toBe(200);
    expect((await sqlOne<any>('SELECT hidden_from_members FROM case_table WHERE case_id = ?', [empty])).hidden_from_members).toBe(1);
    expect((await api.get(`/api/cases/${empty}`, { token: w.users.viewer.token })).status).toBe(404);
  });
});
