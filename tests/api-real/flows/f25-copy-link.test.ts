/**
 * F25. The copy link (E03 "Copy of the Base case"): a duplicate, a clone and a
 * case created from another record the case they came from; the name is shown
 * only to someone who reaches that case; a link to a case outside the project
 * or out of reach is refused; deleting the original keeps the copy.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sqlOne } from '../support/db';
import { addMember, buildWorld, createCase, createProject, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

describe('F25 copy link', () => {
  it('a duplicate records its original and the case GET names it', async () => {
    const t = w.users.editor.token;
    const dup = await api.post(`/api/cases/${w.P.base.id}/duplicate`, { token: t, json: { case_name: `Shorter cure ${w.tag}` } });
    expect(dup.status, dup.text).toBe(201);
    const got = await api.get(`/api/cases/${dup.json.case_id}`, { token: w.users.viewer.token });
    expect(got.json.case.parent_case_id).toBe(w.P.base.id);
    expect(got.json.case.copied_from).toEqual({ case_id: w.P.base.id, case_name: w.P.base.name });
  });

  it('a duplicate keeps "What will you change?" as its description (E18); too long is refused', async () => {
    const t = w.users.editor.token;
    const dup = await api.post(`/api/cases/${w.P.base.id}/duplicate`, {
      token: t,
      json: { case_name: `Lighter blank ${w.tag}`, description: '  Steel blank from 0.80 kg to 0.78 kg ' },
    });
    expect(dup.status, dup.text).toBe(201);
    expect(await sqlOne('SELECT description, parent_case_id FROM case_table WHERE case_id = ?', [dup.json.case_id])).toEqual({
      description: 'Steel blank from 0.80 kg to 0.78 kg',
      parent_case_id: w.P.base.id,
    });
    const long = await api.post(`/api/cases/${w.P.base.id}/duplicate`, { token: t, json: { case_name: `Too long ${w.tag}`, description: 'x'.repeat(70000) } });
    expect(long.status).toBe(400);
  });

  it('a clone into an empty case records its source', async () => {
    const empty = await w.fresh.emptyCase();
    const res = await api.post(`/api/cases/${empty}/clone-from`, { token: w.users.editor.token, json: { sourceCaseId: w.P.base.id } });
    expect(res.status, res.text).toBe(200);
    expect((await sqlOne('SELECT parent_case_id FROM case_table WHERE case_id = ?', [empty])).parent_case_id).toBe(w.P.base.id);
  });

  it('create with parent_case_id: a case of this project is linked; another project, a bad id or an unreachable case is refused', async () => {
    const t = w.users.editor.token;
    const ok = await api.post(`/api/projects/${w.P.id}/cases`, {
      token: t,
      json: { case_name: `Linked ${w.tag}`, case_type: 'comparative', parent_case_id: w.P.base.id },
    });
    expect(ok.status, ok.text).toBe(201);
    expect(ok.json.case.parent_case_id).toBe(w.P.base.id);
    for (const parent_case_id of [w.Q.caseId, 'abc', 999999999]) {
      const bad = await api.post(`/api/projects/${w.P.id}/cases`, {
        token: t,
        json: { case_name: `Bad link ${parent_case_id} ${w.tag}`, case_type: 'comparative', parent_case_id },
      });
      expect(bad.status, String(parent_case_id)).toBe(400);
      expect(bad.json.error).toBe('The case to copy from was not found in this project');
    }
  });

  it("with members seeing only their own cases, a student's copy of another student's case never names it", async () => {
    // Class project: the owner's switch on; two students as editors.
    const owner = w.users.owner;
    const pid = await createProject(owner, `Class ${w.tag}`);
    await addMember(owner, pid, w.users.editor, 'editor');
    await addMember(owner, pid, w.users.adminm, 'editor');
    expect((await api.put(`/api/projects/${pid}`, { token: owner.token, json: { members_see_own_cases: true } })).status).toBe(200);
    const other = await createCase(w.users.adminm, pid, `Student A ${w.tag}`);
    // Student B cannot link to A's case: it is out of reach.
    const refused = await api.post(`/api/projects/${pid}/cases`, {
      token: w.users.editor.token,
      json: { case_name: `Student B ${w.tag}`, case_type: 'comparative', parent_case_id: other },
    });
    expect(refused.status).toBe(400);
    // A link made earlier (an owner's own copy reassigned) is still hidden from B.
    const mine = await createCase(w.users.editor, pid, `Student B own ${w.tag}`);
    await sqlOne('UPDATE case_table SET parent_case_id = ? WHERE case_id = ?', [other, mine]);
    const got = await api.get(`/api/cases/${mine}`, { token: w.users.editor.token });
    expect(got.json.case.parent_case_id).toBeNull();
    expect(got.json.case.copied_from).toBeNull();
    const list = await api.get(`/api/projects/${pid}/cases`, { token: w.users.editor.token });
    expect(list.json.cases.find((c: any) => c.case_id === mine).parent_case_id).toBeNull();
    const progress = await api.get(`/api/projects/${pid}/progress`, { token: w.users.editor.token });
    expect(progress.json.cases.find((c: any) => c.case_id === mine).copied_from).toBeNull();
    // The owner reaches both and sees the link.
    expect((await api.get(`/api/cases/${mine}`, { token: owner.token })).json.case.copied_from).toEqual({ case_id: other, case_name: `Student A ${w.tag}` });
  });

  it('deleting the original keeps the copy, unlinked', async () => {
    const t = w.users.editor.token;
    const original = await createCase(w.users.editor, w.P.id, `Original ${w.tag}`);
    const copy = await api.post(`/api/projects/${w.P.id}/cases`, {
      token: t,
      json: { case_name: `Copy of original ${w.tag}`, case_type: 'comparative', parent_case_id: original },
    });
    expect((await api.delete(`/api/cases/${original}`, { token: w.users.adminm.token })).status).toBe(200);
    const after = await api.get(`/api/cases/${copy.json.case.case_id}`, { token: t });
    expect(after.status).toBe(200);
    expect(after.json.case).toMatchObject({ parent_case_id: null, copied_from: null });
  });
});
