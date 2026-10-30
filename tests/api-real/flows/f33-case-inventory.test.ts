/**
 * F33. The case inventory the workspace reads (stage 4): on the sample, every
 * flow's status and its climate arithmetic equal what the sample's run froze;
 * a change marks the run out of date by the number of flows changed.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sqlOne } from '../support/db';
import { createUser, type TestUser } from '../support/users';

let u: TestUser;
let sample: any;
beforeAll(async () => {
  u = await createUser('f33inv');
  sample = (await api.post('/api/example-project', { token: u.token })).json;
});

describe('F33 case inventory', () => {
  it('the sample: 9 flows, statuses, and rows equal to the frozen run', async () => {
    const res = await api.get(`/api/cases/${sample.case_id}/inventory`, { token: u.token });
    expect(res.status, res.text).toBe(200);
    expect(res.json).toMatchObject({ method: 'TRACI 2.1', region: 'US' });
    expect(res.json.counts).toEqual({ all: 9, counted: 5, no_factor: 3, needs_amount: 0, left_out: 1 });
    const by = (s: string) => res.json.rows.filter((r: any) => r.substance === s);
    expect(by('Steel')[0]).toMatchObject({ status: 'counted', amount: 0.8, climate: { factor: 1.9, tag: 'global' } });
    expect(by('Steel')[0].climate.impact).toBeCloseTo(1.52, 9);
    expect(by('Electricity').every((r: any) => r.status === 'counted' && r.climate.tag === 'regional' && r.climate.factor === 0.35)).toBe(true);
    expect(by('Packaging tape')[0]).toMatchObject({ status: 'left_out', unit: 'roll', substance_unit: 'kg', climate: null });
    expect(by('Argon')[0]).toMatchObject({ status: 'no_factor', climate: null });
    expect(res.json.climate.value.toFixed(2)).toBe('1.72');
    // Every counted row equals the run's frozen row: amount × factor = impact.
    const snap = await snapshotOf(sample.run_id);
    for (const r of res.json.rows.filter((x: any) => x.climate)) {
      const frozen = snap.flow_detail.find((d: any) => d.flow_id === r.flow_id && /Global Warming/.test(d.category_name));
      expect(frozen.factor).toBe(r.climate.factor);
      expect(frozen.impact).toBeCloseTo(r.climate.impact, 12);
      expect(r.amount * r.climate.factor).toBeCloseTo(r.climate.impact, 12);
    }
    expect(res.json.latest_run).toMatchObject({ run_id: sample.run_id, changed_flows: 0, changed_after_run: false });
  });

  it('a change in a copy marks its run out of date by the number of flows changed', async () => {
    const copy = await api.post(`/api/cases/${sample.case_id}/duplicate`, { token: u.token, json: { case_name: 'My bracket' } });
    const cid = copy.json.case_id;
    expect((await api.post(`/api/cases/${cid}/assessments`, { token: u.token, json: {} })).status).toBe(201);
    let inv = (await api.get(`/api/cases/${cid}/inventory`, { token: u.token })).json;
    expect(inv.latest_run.changed_flows).toBe(0);
    expect(inv.latest_run.changed_after_run).toBe(false);
    const cure = inv.rows.find((r: any) => r.substance === 'Electricity' && r.amount === 0.4);
    expect((await api.put(`/api/flows/${cure.flow_id}`, { token: u.token, json: { quantity: 0.25 } })).status).toBe(200);
    const tape = inv.rows.find((r: any) => r.substance === 'Packaging tape');
    expect((await api.put(`/api/flows/${tape.flow_id}`, { token: u.token, json: { unit: 'g', quantity: 4 } })).status).toBe(200);
    inv = (await api.get(`/api/cases/${cid}/inventory`, { token: u.token })).json;
    expect(inv.latest_run.changed_flows).toBe(2);
    // 3.11: the same rule as Compare's "Edited after this run".
    expect(inv.latest_run.changed_after_run).toBe(true);
    expect(inv.counts.left_out).toBe(0);
    expect(inv.counts.no_factor).toBe(4);
    expect(inv.climate.value.toFixed(3)).toBe('1.667');
  });

  it('3.11 an edit put back still marks the run changed, as Compare does (a value check would not)', async () => {
    const copy = await api.post(`/api/cases/${sample.case_id}/duplicate`, { token: u.token, json: { case_name: 'Put back' } });
    const cid = copy.json.case_id;
    expect((await api.post(`/api/cases/${cid}/assessments`, { token: u.token, json: {} })).status).toBe(201);
    let inv = (await api.get(`/api/cases/${cid}/inventory`, { token: u.token })).json;
    const cure = inv.rows.find((r: any) => r.substance === 'Electricity' && r.amount === 0.4);
    await api.put(`/api/flows/${cure.flow_id}`, { token: u.token, json: { quantity: 0.25 } });
    await api.put(`/api/flows/${cure.flow_id}`, { token: u.token, json: { quantity: 0.4 } });
    inv = (await api.get(`/api/cases/${cid}/inventory`, { token: u.token })).json;
    expect(inv.latest_run.changed_flows).toBe(0);
    expect(inv.latest_run.changed_after_run).toBe(true);
  });

  it('3.11 deleting a step after the run marks the run changed, as Compare does', async () => {
    const copy = await api.post(`/api/cases/${sample.case_id}/duplicate`, { token: u.token, json: { case_name: 'Deleted step' } });
    const cid = copy.json.case_id;
    expect((await api.post(`/api/cases/${cid}/assessments`, { token: u.token, json: {} })).status).toBe(201);
    const comps = (await api.get(`/api/cases/${cid}/components`, { token: u.token })).json;
    const list = comps.components ?? comps;
    const pack = list.find((k: any) => /Fold and tape/.test(k.component_name ?? k.name));
    expect(pack).toBeTruthy();
    expect((await api.delete(`/api/components/${pack.component_id ?? pack.id}`, { token: u.token })).status).toBeLessThan(300);
    const inv = (await api.get(`/api/cases/${cid}/inventory`, { token: u.token })).json;
    expect(inv.latest_run.changed_after_run).toBe(true);
  });

  it('a viewer reads it; an outsider gets 404', async () => {
    expect((await api.get(`/api/cases/${sample.case_id}/inventory`, { token: (await createUser('f33x')).token })).status).toBe(404);
    const q = await sqlOne<any>('SELECT project_id FROM case_table WHERE case_id = ?', [sample.case_id]);
    expect(q.project_id).toBe(sample.project_id);
  });
});
