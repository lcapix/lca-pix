/**
 * F37. A flow's life-cycle stage (migrate-046): a material going in counts in
 * Materials, the step's electricity in the step's stage, and a stage a person
 * sets overrides the rule until they hand it back. The run freezes each flow's
 * stage; the case total never changes with the split.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sqlOne } from '../support/db';
import { addFlow, buildWorld, createCase, createComponent, createProject, type World } from '../support/world';

let w: World;
let caseId: number;
let step: number;
const ids: Record<string, number> = {};

async function substance(name: string) {
  const r = await sqlOne<{ substance_id: number }>(
    `SELECT s.substance_id FROM substances s WHERE s.substance_name = ? ORDER BY s.substance_id LIMIT 1`,
    [name],
  );
  return Number(r!.substance_id);
}

async function run() {
  const res = await api.post(`/api/cases/${caseId}/assessments`, {
    token: w.users.owner.token,
    json: { calculation_method: 'TRACI 2.1', region_code: 'US' },
  });
  expect(res.status, res.text).toBe(201);
  const snap = await snapshotOf(res.json.run_id);
  const gw = snap.flow_detail.filter((r: any) => r.category_name === 'Global Warming');
  const stageOf = (flowId: number) => gw.find((r: any) => r.flow_id === flowId)?.stage;
  const total = gw.reduce((s: number, r: any) => s + r.impact, 0);
  return { stageOf, total };
}

beforeAll(async () => {
  w = await buildWorld({ runs: false });
  const owner = w.users.owner;
  const projectId = await createProject(owner, `Stages ${w.tag}`, { lcia_method: 'TRACI 2.1', region_code: 'US' });
  caseId = await createCase(owner, projectId, `Welded part ${w.tag}`);
  step = await createComponent(owner, caseId, { component_name: `Weld ${w.tag}`, component_type: 'operation', parent_component_id: null, quantity: 1, unit: 'unit' });
  await api.put(`/api/components/${step}`, { token: owner.token, json: { life_cycle_stage: 'production' } });
  ids.steel = await addFlow(owner, step, { substance_id: await substance('Steel'), flow_type: 'input', quantity: 0.8, unit: 'kg' });
  ids.power = await addFlow(owner, step, { substance_id: await substance('Electricity'), flow_type: 'input', quantity: 0.4, unit: 'kWh' });
});

describe('F37 a flow counts in its own life-cycle stage', () => {
  it('the rule: steel going in is Materials, the step’s electricity is Production; the run freezes both', async () => {
    const r = await run();
    expect(r.stageOf(ids.steel)).toBe('materials');
    expect(r.stageOf(ids.power)).toBe('production');
  });

  it('a stage a person sets wins, the total stays, and null hands it back to the rule', async () => {
    const before = await run();
    const set = await api.put(`/api/flows/${ids.steel}`, { token: w.users.owner.token, json: { life_cycle_stage: 'production' } });
    expect(set.status, set.text).toBe(200);
    expect((await sqlOne<any>('SELECT life_cycle_stage FROM flows WHERE flow_id = ?', [ids.steel]))!.life_cycle_stage).toBe('production');
    const overridden = await run();
    expect(overridden.stageOf(ids.steel)).toBe('production');
    expect(overridden.total).toBeCloseTo(before.total, 9);

    const back = await api.put(`/api/flows/${ids.steel}`, { token: w.users.owner.token, json: { life_cycle_stage: null } });
    expect(back.status, back.text).toBe(200);
    expect((await sqlOne<any>('SELECT life_cycle_stage FROM flows WHERE flow_id = ?', [ids.steel]))!.life_cycle_stage).toBeNull();
    expect((await run()).stageOf(ids.steel)).toBe('materials');
  });

  it('an unknown stage is refused and changes nothing', async () => {
    const bad = await api.put(`/api/flows/${ids.power}`, { token: w.users.owner.token, json: { life_cycle_stage: 'shipping' } });
    expect(bad.status).toBe(400);
    expect((await sqlOne<any>('SELECT life_cycle_stage FROM flows WHERE flow_id = ?', [ids.power]))!.life_cycle_stage).toBeNull();
  });

  it('the inventory says which stage each flow counts in, and whether a person set it', async () => {
    await api.put(`/api/flows/${ids.power}`, { token: w.users.owner.token, json: { life_cycle_stage: 'use' } });
    const inv = await api.get(`/api/cases/${caseId}/inventory`, { token: w.users.owner.token });
    expect(inv.status, inv.text).toBe(200);
    const row = (id: number) => inv.json.rows.find((r: any) => r.flow_id === id);
    expect([row(ids.steel).stage, row(ids.steel).stage_set]).toEqual(['materials', false]);
    expect([row(ids.power).stage, row(ids.power).stage_set]).toEqual(['use', true]);
  });
});
