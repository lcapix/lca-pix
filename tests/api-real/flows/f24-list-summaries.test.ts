/**
 * F24. What the list screens read (E07, E12, E19): each case's latest
 * completed run with the headline per functional unit, how many flows need an
 * amount, whether it has a write-up, the case it was copied from; each
 * project's people and latest activity.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: true });
});

describe('F24 list summaries', () => {
  it('a case list gives the latest run with its headline, flows needing an amount, the write-up and the copy link', async () => {
    const t = w.users.editor.token;
    await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: t,
      json: { substance_id: w.substances.steel, flow_type: 'input', unit: 'kg' },
    });
    const res = await api.get(`/api/projects/${w.P.id}/case-summaries`, { token: w.users.viewer.token });
    expect(res.status, res.text).toBe(200);
    const base = res.json.cases.find((c: any) => c.case_id === w.P.base.id);
    const comp = res.json.cases.find((c: any) => c.case_id === w.P.comp.id);
    expect(base).toMatchObject({ flows_missing_amount: 1, copied_from: null, has_interpretation: false });
    expect(base).not.toHaveProperty('stage');
    expect(base.latest_run).toMatchObject({ run_id: w.P.base.run, method: expect.any(String) });
    expect(base.latest_run.headline).toMatchObject({ category: 'Global Warming', unit: expect.stringMatching(/CO2/) });
    expect(base.latest_run.headline.value).toBeGreaterThan(0);
    // The comparative case is a copy of the base case.
    const [{ parent_case_id }] = await sql<any>('SELECT parent_case_id FROM case_table WHERE case_id = ?', [w.P.comp.id]);
    expect(comp.copied_from).toBe(parent_case_id == null ? null : Number(parent_case_id));

    // Writing the interpretation shows as a write-up.
    expect((await api.put(`/api/cases/${w.P.base.id}`, { token: t, json: { interpretation: 'Natural gas drives it.' } })).status).toBe(200);
    const again = await api.get(`/api/projects/${w.P.id}/case-summaries`, { token: t });
    expect(again.json.cases.find((c: any) => c.case_id === w.P.base.id).has_interpretation).toBe(true);
  });

  it('a case that has not run has no latest run; another tenant gets 404', async () => {
    const caseId = await w.fresh.emptyCase();
    const res = await api.get(`/api/projects/${w.P.id}/case-summaries`, { token: w.users.owner.token });
    expect(res.json.cases.find((c: any) => c.case_id === caseId)).toMatchObject({ latest_run: null, runs: 0, flows_missing_amount: 0 });
    expect((await api.get(`/api/projects/${w.Q.id}/case-summaries`, { token: w.users.viewer.token })).status).toBe(404);
  });

  it('the projects list gives the owner name, people and the latest run date', async () => {
    const res = await api.get('/api/projects', { token: w.users.editor.token });
    expect(res.status).toBe(200);
    const p = res.json.projects.find((x: any) => x.project_id === w.P.id);
    expect(p.owner_name).toBeTruthy();
    expect(Number(p.member_count)).toBeGreaterThanOrEqual(3);
    expect(p.last_run_at).toBeTruthy();
    expect(p.last_case_update).toBeTruthy();
    // Another tenant's project never appears.
    expect(res.json.projects.some((x: any) => x.project_id === w.Q.id)).toBe(false);
  });

  it("Home's summaries: the base case's latest result, changed after its run, members' cases with no run, held lines", async () => {
    // B's project: run, nothing edited since.
    const mine = await api.get('/api/projects', { token: w.users.userB.token });
    const q = mine.json.projects.find((x: any) => x.project_id === w.Q.id);
    expect(q.base_run).toMatchObject({ run_id: w.Q.run, headline: { category: 'Global Warming' } });
    expect(q.base_changed_after_run).toBe(false);

    // P: the first test added a flow to the base case after its run.
    const before = (await api.get('/api/projects', { token: w.users.owner.token })).json.projects.find((x: any) => x.project_id === w.P.id);
    expect(before.base_case_id).toBe(w.P.base.id);
    expect(before.base_run.run_id).toBe(w.P.base.run);
    expect(before.base_changed_after_run).toBe(true);
    expect(before).not.toHaveProperty('hand_ins');
    expect(before).not.toHaveProperty('is_sample');
    // People: the owner once, with the members (the owner also holds a members row).
    const [{ others }] = await sql<any>(
      'SELECT COUNT(*) AS others FROM project_members WHERE project_id = ? AND user_id <> ?', [w.P.id, w.users.owner.id]);
    expect(before.people).toBe(1 + Number(others));
    // Someone who does not run the project is not told (null), but sees the result.
    const asEditor = (await api.get('/api/projects', { token: w.users.editor.token })).json.projects.find((x: any) => x.project_id === w.P.id);
    expect(asEditor.base_changed_after_run).toBeNull();
    expect(asEditor.base_run.run_id).toBe(w.P.base.run);

    // A member's case with no run counts; held lines name their case.
    await sql(
      `INSERT INTO case_table (project_id, case_name, case_type, created_by) VALUES (?, ?, 'comparative', ?)`,
      [w.P.id, `Member case ${Date.now()}`, w.users.editor.id],
    );
    await w.fresh.heldLine();
    const after = (await api.get('/api/projects', { token: w.users.owner.token })).json.projects.find((x: any) => x.project_id === w.P.id);
    expect(after.member_cases_without_run).toBe(before.member_cases_without_run + 1);
    expect(after.held_lines).toBeGreaterThanOrEqual(1);
    expect(after.held_case).toEqual({ case_id: w.P.base.id, case_name: w.P.base.name });
  });
});
