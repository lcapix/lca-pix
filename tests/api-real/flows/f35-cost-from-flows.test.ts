/**
 * F35. A step's material and energy cost from its own flows (E14): the costs
 * route says what the flows would cost next to the stored cost, and one PUT
 * with mode "flows" stores that number with a line per priced flow. The
 * number is worked out on the server; a material with no reference price is
 * left out and named, never guessed.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sqlOne } from '../support/db';
import { addFlow, buildWorld, substanceId, type World } from '../support/world';

let w: World;
let argon: number;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
  argon = await substanceId('Argon');
  // The operation gets steel and argon; the sub-process gets argon only.
  await addFlow(w.users.owner, w.P.base.op, { substance_id: w.substances.steel, flow_type: 'input', quantity: 0.8, unit: 'kg' });
  await addFlow(w.users.owner, w.P.base.op, { substance_id: argon, flow_type: 'input', quantity: 0.18, unit: 'kg' });
  await addFlow(w.users.owner, w.P.base.subprocess, { substance_id: argon, flow_type: 'input', quantity: 0.06, unit: 'kg' });
});

const url = (id: number) => `/api/components/${id}/costs`;
const use = { kind: 'material', mode: 'flows' };
const kind = (body: any, k: string) => body.costs.find((c: any) => c.kind === k);

describe('F35 cost from flows', () => {
  it('GET says what the flows would cost: steel priced, argon named, nothing stored yet', async () => {
    const res = await api.get(url(w.P.base.op), { token: w.users.viewer.token });
    expect(res.status, res.text).toBe(200);
    expect(kind(res.json, 'material').amount).toBeNull();
    expect(res.json.from_flows.material).toEqual({
      kind: 'material',
      amount: 0.76,
      lines: [{
        label: 'Steel', quantity: 0.8, unit: 'kg', rate: 0.95, rate_unit: '$/kg',
        source_kind: 'reference', source_name: 'Steel, hot-rolled', vintage: '2026-06',
      }],
      noPrice: ['Argon'],
    });
    // The world's operation also burns 1.8 m3 of natural gas: energy is offered too.
    expect(res.json.from_flows.energy).toMatchObject({
      kind: 'energy', amount: 0.504, noPrice: [],
      lines: [{ label: 'Natural Gas', quantity: 1.8, unit: 'm3', rate: 0.28, rate_unit: '$/m3' }],
    });
  });

  it('access: a viewer cannot use it (403); outsiders 404; anonymous 401', async () => {
    expect((await api.put(url(w.P.base.op), { token: w.users.viewer.token, json: use })).status).toBe(403);
    expect((await api.put(url(w.P.base.op), { token: w.users.nonmem.token, json: use })).status).toBe(404);
    expect((await api.put(url(w.P.base.op), { token: w.users.userB.token, json: use })).status).toBe(404);
    expect((await api.put(url(w.P.base.op), { json: use })).status).toBe(401);
    expect((await sqlOne<any>('SELECT material_cost FROM component WHERE component_id = ?', [w.P.base.op])).material_cost).toBeNull();
  });

  it('PUT mode "flows" stores the flows\' number and its lines; an amount in the request is ignored', async () => {
    const res = await api.put(url(w.P.base.op), { token: w.users.editor.token, json: { ...use, amount: 99 } });
    expect(res.status, res.text).toBe(200);
    const material = kind(res.json, 'material');
    expect(material.amount).toBe(0.76);
    expect(material.basis).toMatchObject({
      rate_code: 'flows', source_kind: 'reference', source_name: "Reference prices for the step's flows", vintage: '2026-06',
      driver_quantity: null, rate: null,
    });
    expect(material.basis.lines).toHaveLength(1);
    expect(material.basis.lines[0]).toMatchObject({ label: 'Steel', quantity: 0.8, rate: 0.95 });
    expect((await sqlOne<any>('SELECT material_cost FROM component WHERE component_id = ?', [w.P.base.op])).material_cost).toBe('0.76');
  });

  it('a step whose only material has no price: 400 naming it, nothing stored', async () => {
    const res = await api.put(url(w.P.base.subprocess), { token: w.users.editor.token, json: use });
    expect(res.status, res.text).toBe(400);
    expect(res.json.error).toBe('No material flow on this step has a price (Argon): add the cost by hand.');
    expect((await sqlOne<any>('SELECT material_cost FROM component WHERE component_id = ?', [w.P.base.subprocess])).material_cost).toBeNull();
  });

  it('a step with no flows, and a kind flows cannot price: 400', async () => {
    const none = await api.put(url(w.P.base.machine), { token: w.users.editor.token, json: { kind: 'energy', mode: 'flows' } });
    expect(none.status, none.text).toBe(400);
    expect(none.json.error).toBe('This step has no energy flow with an amount to price.');
    const labor = await api.put(url(w.P.base.op), { token: w.users.editor.token, json: { kind: 'labor', mode: 'flows' } });
    expect(labor.status, labor.text).toBe(400);
    expect(labor.json.error).toBe('kind: material or energy, for mode "flows"');
  });

  it('energy from the task\'s electricity and gas: priced line by line in its own units', async () => {
    const res = await api.put(url(w.P.base.task), { token: w.users.editor.token, json: { kind: 'energy', mode: 'flows' } });
    expect(res.status, res.text).toBe(200);
    const energy = kind(res.json, 'energy');
    expect(energy.basis.rate_code).toBe('flows');
    expect(energy.basis.lines.map((l: any) => l.label)).toEqual(expect.arrayContaining(['Electricity']));
    const sum = energy.basis.lines.reduce((t: number, l: any) => t + l.quantity * l.rate, 0);
    expect(energy.amount).toBe(Math.round(sum * 100) / 100);
    expect(res.json.from_flows.energy.amount).toBeCloseTo(sum, 6);
  });
});
