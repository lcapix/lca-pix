/**
 * F24. What the list screens read (E07, E07b, E10, E12, E19): each case's
 * stage, its latest completed run with the headline per functional unit, how
 * many flows need an amount, the case it was copied from; each project's
 * people and latest activity. Members who see only their own cases get
 * summaries of their own cases only.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql } from '../support/db';
import { buildWorld, createCase, createComponent, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: true });
});

describe('F24 list summaries', () => {
  it('a case list gives stage, latest run with its headline, flows needing an amount and the copy link', async () => {
    const t = w.users.editor.token;
    await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: t,
      json: { substance_id: w.substances.steel, flow_type: 'input', unit: 'kg' },
    });
    const res = await api.get(`/api/projects/${w.P.id}/progress`, { token: w.users.viewer.token });
    expect(res.status, res.text).toBe(200);
    const base = res.json.cases.find((c: any) => c.case_id === w.P.base.id);
    const comp = res.json.cases.find((c: any) => c.case_id === w.P.comp.id);
    expect(base).toMatchObject({ stage: 'run', flows_missing_amount: 1, copied_from: null });
    expect(base.latest_run).toMatchObject({ run_id: w.P.base.run, method: expect.any(String) });
    expect(base.latest_run.headline).toMatchObject({ category: 'Global Warming', unit: expect.stringMatching(/CO2/) });
    expect(base.latest_run.headline.value).toBeGreaterThan(0);
    // The comparative case is a copy of the base case.
    const [{ parent_case_id }] = await sql<any>('SELECT parent_case_id FROM case_table WHERE case_id = ?', [w.P.comp.id]);
    expect(comp.copied_from).toBe(parent_case_id == null ? null : Number(parent_case_id));

    // Writing the interpretation moves the case to Written; the tick to Ticked.
    expect((await api.put(`/api/cases/${w.P.base.id}`, { token: t, json: { interpretation: 'Natural gas drives it.' } })).status).toBe(200);
    let again = await api.get(`/api/projects/${w.P.id}/progress`, { token: t });
    expect(again.json.cases.find((c: any) => c.case_id === w.P.base.id).stage).toBe('written');
    expect((await api.put(`/api/cases/${w.P.base.id}`, { token: t, json: { is_final: true } })).status).toBe(200);
    again = await api.get(`/api/projects/${w.P.id}/progress`, { token: t });
    expect(again.json.cases.find((c: any) => c.case_id === w.P.base.id).stage).toBe('handed_in');
  });

  it('a case that has not run is "not_run" with no latest run', async () => {
    const caseId = await w.fresh.emptyCase();
    const res = await api.get(`/api/projects/${w.P.id}/progress`, { token: w.users.owner.token });
    expect(res.json.cases.find((c: any) => c.case_id === caseId)).toMatchObject({ stage: 'not_run', latest_run: null, flows_missing_amount: 0 });
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

  it("Home's summaries: the base case's latest result, changed after its run, hand-ins, members' cases with no run, held lines", async () => {
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
    expect(before.hand_ins).toBeGreaterThanOrEqual(1);
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
  it('the flows left empty, grouped by substance and step, count only the cases the caller reaches (E10)', async () => {
    const editor = w.users.editor;
    const own = await createCase(editor, w.P.id, `Gaps ${w.tag}`, 'comparative');
    const step = await createComponent(editor, own, { component_name: 'Weld it', component_type: 'operation' });
    for (const id of [step]) {
      expect((await api.post(`/api/components/${id}/flows`, { token: editor.token, json: { substance_id: w.substances.steel, flow_type: 'input', unit: 'kg' } })).status).toBe(201);
    }
    const read = async (token: string) => {
      const res = await api.get(`/api/projects/${w.P.id}/empty-flows`, { token });
      expect(res.status, res.text).toBe(200);
      return res.json.flows as Array<{ substance: string; direction: string; step: string; case_ids: number[] }>;
    };
    const all = await read(w.users.viewer.token);
    const weld = all.find((f) => f.step === 'Weld it');
    expect(weld).toMatchObject({ direction: 'input', case_ids: [own] });
    expect(all.some((f) => f.case_ids.includes(w.P.base.id))).toBe(true);
    // Most cases first.
    expect(all.map((f) => f.case_ids.length)).toEqual([...all.map((f) => f.case_ids.length)].sort((a, b) => b - a));

    // With members seeing only their own cases, a reader no longer counts the editor's case.
    expect((await api.put(`/api/projects/${w.P.id}`, { token: w.users.owner.token, json: { members_see_own_cases: true } })).status).toBe(200);
    try {
      expect((await read(w.users.viewer.token)).some((f) => f.case_ids.includes(own))).toBe(false);
      expect((await read(editor.token)).find((f) => f.step === 'Weld it')?.case_ids).toEqual([own]);
    } finally {
      await api.put(`/api/projects/${w.P.id}`, { token: w.users.owner.token, json: { members_see_own_cases: false } });
    }
    expect((await api.get(`/api/projects/${w.Q.id}/empty-flows`, { token: w.users.viewer.token })).status).toBe(404);
  });
});
