/**
 * F34. The runs the workspace's Results tab reads (stage 4): each run carries
 * its own frozen tree with each step's cost (run_steps, E05 "Cost beside
 * impact"), and ?latest=1 answers the newest completed run alone (the note
 * against the Base case). Access is the route's own: an outsider gets 404.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { createUser, type TestUser } from '../support/users';

let u: TestUser;
let outsider: TestUser;
let sample: any;
beforeAll(async () => {
  u = await createUser('f34runs');
  outsider = await createUser('f34out');
  sample = (await api.post('/api/example-project', { token: u.token })).json;
});

describe('F34 workspace runs', () => {
  it('a run carries its frozen tree with each step cost: $1.75 a bracket, Weld tab $0.55', async () => {
    const res = await api.get(`/api/cases/${sample.case_id}/assessments`, { token: u.token });
    expect(res.status, res.text).toBe(200);
    const run = res.json.assessments.find((a: any) => a.run_id === sample.run_id);
    expect(run.run_steps).toHaveLength(17);
    const total = run.run_steps.reduce((t: number, s: any) => t + (s.cost ?? 0), 0);
    expect(total.toFixed(2)).toBe('1.75');
    const weld = run.run_steps.find((s: any) => s.name === '20. Weld tab');
    expect(weld).toMatchObject({ type: 'operation', currency: 'USD' });
    expect(weld.cost.toFixed(2)).toBe('0.55');
    // The tree is the run's: every parent named is a step of the run.
    const ids = new Set(run.run_steps.map((s: any) => s.component_id));
    expect(run.run_steps.every((s: any) => s.parent_id === null || ids.has(s.parent_id))).toBe(true);
  });

  it('?latest=1 answers the newest completed run alone; an outsider gets 404', async () => {
    const res = await api.get(`/api/cases/${sample.what_if_case_id}/assessments?latest=1`, { token: u.token });
    expect(res.status, res.text).toBe(200);
    expect(res.json.assessments).toHaveLength(1);
    expect(res.json.assessments[0]).toMatchObject({ run_id: sample.what_if_run_id, status: 'completed' });
    const gw = Object.entries(res.json.assessments[0].impacts).find(([k]) => /global warming/i.test(k)) as any;
    expect(gw[1].value.toFixed(3)).toBe('1.667');
    const out = await api.get(`/api/cases/${sample.case_id}/assessments?latest=1`, { token: outsider.token });
    expect(out.status).toBe(404);
  });
});
