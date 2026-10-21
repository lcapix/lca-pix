/**
 * F29. Import lines held for review are kept (migrate-040, E12 "lines held"):
 * an import keeps every line it cannot place, with why; a member reads them;
 * someone who may change the case resolves one into a flow or a cost (checked
 * like any new flow) or dismisses it; a line acts once.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
let caseId: number;
let lines: any[];
beforeAll(async () => {
  w = await buildWorld({ runs: false });
  const res = await api.post('/api/ingest/apply', {
    token: w.users.editor.token,
    json: {
      project_id: w.P.id,
      case_name: `Held lines ${w.tag}`,
      nodes: [
        { name: `Bracket ${w.tag}`, tier: 'product', parent: null },
        { name: `Bend ${w.tag}`, tier: 'machine_line', parent: `Bracket ${w.tag}` },
      ],
      flows: [
        { node: `Bend ${w.tag}`, substance_text: 'zinc primer', substance_id: null, direction: 'input', quantity: 0.01, unit: 'kg', provenance: 'BOM row 4' },
        { node: `Paint ${w.tag}`, substance_text: 'grid power', substance_id: w.substances.electricity, direction: 'input', quantity: 0.3, unit: 'kWh' },
        { node: `Bend ${w.tag}`, substance_text: 'press power', substance_id: w.substances.electricity, direction: 'input', quantity: 2, unit: 'kg' },
        { node: `Bend ${w.tag}`, substance_text: 'sheet', substance_id: w.substances.steel, direction: 'input', quantity: 0.8, unit: 'kg' },
      ],
      costs: [{ node: `Paint ${w.tag}`, category: 'labor', amount: 1.25, hours: 0.05, occupation: '51-9124' }],
      notes: [],
    },
  });
  expect(res.status, res.text).toBe(201);
  expect(res.json).toMatchObject({ flows_applied: 1, flows_held_for_review: 3, held_lines_kept: 4 });
  caseId = Number(res.json.case_id);
  lines = (await api.get(`/api/cases/${caseId}/held-lines`, { token: w.users.viewer.token })).json.lines;
});

const lineWith = (text: string) => lines.find((l) => (l.substance_text ?? l.cost_category) === text);
const bend = async () =>
  Number((await sqlOne<any>(`SELECT component_id FROM component WHERE case_id = ? AND component_name = ?`, [caseId, `Bend ${w.tag}`])).component_id);

describe('F29 held import lines', () => {
  it('every held line is kept with why, readable by any member; the projects list counts them', async () => {
    expect(lines.map((l) => [l.line_kind, l.reason, l.substance_text ?? l.cost_category])).toEqual([
      ['flow', 'no_substance', 'zinc primer'],
      ['flow', 'no_step', 'grid power'],
      ['flow', 'unit', 'press power'],
      ['cost', 'no_step', 'labor'],
    ]);
    expect(lineWith('zinc primer')).toMatchObject({ quantity: 0.01, unit: 'kg', provenance: 'BOM row 4', reason_text: 'no confirmed substance match', status: 'held' });
    expect(lineWith('labor')).toMatchObject({ amount: 1.25, hours: 0.05, step_name: `Paint ${w.tag}` });
    const list = await api.get('/api/projects', { token: w.users.editor.token });
    expect(list.json.projects.find((p: any) => p.project_id === w.P.id).held_lines).toBe(4);
    expect((await api.get(`/api/cases/${caseId}/held-lines`, { token: w.users.nonmem.token })).status).toBe(404);
  });

  it('a viewer cannot act; a step of another case and a unit the substance cannot take are refused', async () => {
    const zinc = lineWith('zinc primer').held_id;
    expect((await api.put(`/api/held-lines/${zinc}`, { token: w.users.viewer.token, json: { action: 'dismiss' } })).status).toBe(403);
    expect((await api.put(`/api/held-lines/${zinc}`, { token: w.users.nonmem.token, json: { action: 'dismiss' } })).status).toBe(404);
    const t = w.users.editor.token;
    const other = await api.put(`/api/held-lines/${zinc}`, { token: t, json: { action: 'resolve', component_id: w.P.base.op, substance_id: w.substances.steel } });
    expect(other.status).toBe(400);
    const noSubstance = await api.put(`/api/held-lines/${zinc}`, { token: t, json: { action: 'resolve', component_id: await bend() } });
    expect(noSubstance.status).toBe(400);
    const press = lineWith('press power').held_id;
    const unit = await api.put(`/api/held-lines/${press}`, { token: t, json: { action: 'resolve', component_id: await bend() } });
    expect(unit.status).toBe(400);
    expect(unit.json.error).toMatch(/cannot be converted to 'kWh'/);
    for (const json of [{ action: 'resolve' }, { action: 'explode' }, { action: 'dismiss', extra: 1 }]) {
      expect((await api.put(`/api/held-lines/${press}`, { token: t, json })).status, JSON.stringify(json)).toBe(400);
    }
  });

  it('resolve a flow: created on the step with the chosen substance, once', async () => {
    const t = w.users.editor.token;
    const zinc = lineWith('zinc primer').held_id;
    const ok = await api.put(`/api/held-lines/${zinc}`, { token: t, json: { action: 'resolve', component_id: await bend(), substance_id: w.substances.steel } });
    expect(ok.status, ok.text).toBe(200);
    expect(await sqlOne('SELECT component_id, substance_id, flow_type, quantity, unit FROM flows WHERE flow_id = ?', [ok.json.flow_id])).toEqual({
      component_id: await bend(), substance_id: w.substances.steel, flow_type: 'input', quantity: 0.01, unit: 'kg',
    });
    const again = await api.put(`/api/held-lines/${zinc}`, { token: t, json: { action: 'dismiss' } });
    expect(again.status).toBe(409);
    // The unit line, with a unit that converts.
    const press = lineWith('press power').held_id;
    const fixed = await api.put(`/api/held-lines/${press}`, { token: t, json: { action: 'resolve', component_id: await bend(), unit: 'kWh' } });
    expect(fixed.status, fixed.text).toBe(200);
  });

  it('resolve a cost: added to the step and its old basis dropped; dismiss keeps the record', async () => {
    const t = w.users.editor.token;
    const step = await bend();
    await api.put(`/api/components/${step}/costs`, { token: t, json: { kind: 'labor', mode: 'entered', driver_quantity: 0.1, rate: 20 } });
    const labor = lineWith('labor').held_id;
    const ok = await api.put(`/api/held-lines/${labor}`, { token: t, json: { action: 'resolve', component_id: step } });
    expect(ok.status, ok.text).toBe(200);
    expect(Number((await sqlOne<any>('SELECT labor_cost FROM component WHERE component_id = ?', [step])).labor_cost)).toBeCloseTo(3.25, 9);
    expect(await sql(`SELECT cost_kind FROM component_cost_basis WHERE component_id = ? AND cost_kind = 'labor'`, [step])).toEqual([]);

    const grid = lineWith('grid power').held_id;
    expect((await api.put(`/api/held-lines/${grid}`, { token: t, json: { action: 'dismiss' } })).status).toBe(200);
    const after = await api.get(`/api/cases/${caseId}/held-lines?all=1`, { token: t });
    expect(after.json.held).toBe(0);
    expect(after.json.lines.map((l: any) => l.status)).toEqual(['resolved', 'dismissed', 'resolved', 'resolved']);
    const list = await api.get('/api/projects', { token: t });
    expect(list.json.projects.find((p: any) => p.project_id === w.P.id).held_lines).toBe(0);
  });
});
