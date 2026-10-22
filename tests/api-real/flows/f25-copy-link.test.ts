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

  it("in a shared project, a copy of another member's case is linked and named for every member", async () => {
    const owner = w.users.owner;
    const pid = await createProject(owner, `Shared ${w.tag}`);
    await addMember(owner, pid, w.users.editor, 'editor');
    await addMember(owner, pid, w.users.adminm, 'editor');
    const other = await createCase(w.users.adminm, pid, `Member A ${w.tag}`);
    const made = await api.post(`/api/projects/${pid}/cases`, {
      token: w.users.editor.token,
      json: { case_name: `Member B ${w.tag}`, case_type: 'comparative', parent_case_id: other },
    });
    expect(made.status, made.text).toBe(201);
    const mine = Number(made.json.case.case_id);
    const got = await api.get(`/api/cases/${mine}`, { token: w.users.editor.token });
    expect(got.json.case.copied_from).toEqual({ case_id: other, case_name: `Member A ${w.tag}` });
    const summaries = await api.get(`/api/projects/${pid}/case-summaries`, { token: w.users.editor.token });
    expect(summaries.json.cases.find((c: any) => c.case_id === mine).copied_from).toBe(other);
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
