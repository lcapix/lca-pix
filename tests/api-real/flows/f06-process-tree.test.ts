/**
 * F6. Build the process tree (5 tiers): add, edit, re-parent, stage, delete
 * (subtree or keep children).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { createUser, type TestUser } from '../support/users';
import { createCase, createComponent, createProject } from '../support/world';

let u: TestUser;
let caseId: number;
beforeAll(async () => {
  u = await createUser('f6');
  const pid = await createProject(u, `Tree ${u.id}`);
  caseId = await createCase(u, pid, 'Tree case');
});

const level = async (id: number) => Number((await sqlOne('SELECT hierarchy_level FROM component WHERE component_id = ?', [id])).hierarchy_level);

describe('F6 process tree', () => {
  it('F6.3 builds Product -> Machine/Line -> Subprocess -> Operation -> Elemental task', async () => {
    const tiers = ['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'];
    const ids: number[] = [];
    for (const [i, type] of tiers.entries()) {
      const res = await api.post(`/api/cases/${caseId}/components`, {
        token: u.token,
        json: {
          component_name: `Tier ${i + 1}`,
          component_type: type,
          parent_component_id: i ? ids[i - 1] : null,
          description: `level ${i + 1}`,
          quantity: i === 0 ? 1 : undefined,
          life_cycle_stage: i === 4 ? 'use' : undefined,
        },
      });
      expect(res.status, res.text).toBe(201);
      expect(res.json.component).toMatchObject({ component_type: type, hierarchy_level: i + 1, parent_component_id: i ? ids[i - 1] : null });
      if (i) expect(res.json.component.parent_component_name).toBe(`Tier ${i}`);
      ids.push(Number(res.json.component.component_id));
    }
    const list = await api.get(`/api/cases/${caseId}/components`, { token: u.token });
    expect(list.json.components).toHaveLength(5);
    expect((await sqlOne('SELECT life_cycle_stage FROM component WHERE component_id = ?', [ids[4]])).life_cycle_stage).toBe('use');
  });

  it('F6.4 edits name, description, stage and allocation; clears the description with null', async () => {
    const id = await createComponent(u, caseId, { component_name: 'Edit me', component_type: 'operation' });
    const res = await api.put(`/api/components/${id}`, {
      token: u.token,
      json: {
        component_name: 'Edited',
        component_description: 'first text',
        life_cycle_stage: 'distribution',
        allocation_method: 'economic',
        allocation_factor: 0.25,
        allocation_note: 'by revenue',
      },
    });
    expect(res.status, res.text).toBe(200);
    expect(res.json.component).toMatchObject({ component_name: 'Edited', description: 'first text', life_cycle_stage: 'distribution', allocation_method: 'economic' });
    expect(Number(res.json.component.allocation_factor)).toBe(0.25);

    const cleared = await api.put(`/api/components/${id}`, { token: u.token, json: { component_description: null, life_cycle_stage: null } });
    expect(cleared.status).toBe(200);
    expect(cleared.json.component).toMatchObject({ description: null, life_cycle_stage: null, component_name: 'Edited' });

    for (const bad of [
      { component_type: 'robot' },
      { component_name: '' },
      { component_name: 'x'.repeat(201) },
      { life_cycle_stage: 'afterlife' },
      { allocation_factor: 0 },
      { allocation_factor: 1.5 },
      { allocation_method: 'vibes' },
      { quantity: -1 },
      { unit: 'u'.repeat(51) },
    ]) {
      const r = await api.put(`/api/components/${id}`, { token: u.token, json: bad });
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
  });

  it('F6.4 re-parenting moves the subtree and updates every hierarchy_level (EDIT-9 fixed)', async () => {
    const a = await createComponent(u, caseId, { component_name: 'A line', component_type: 'machine_line' });
    const b = await createComponent(u, caseId, { component_name: 'B sub', component_type: 'subprocess', parent_component_id: a });
    const c = await createComponent(u, caseId, { component_name: 'C op', component_type: 'operation', parent_component_id: b });
    expect([await level(a), await level(b), await level(c)]).toEqual([1, 2, 3]);
    const host = await createComponent(u, caseId, { component_name: 'Host', component_type: 'machine_line' });
    const res = await api.put(`/api/components/${b}`, { token: u.token, json: { parent_component_id: host } });
    expect(res.status, res.text).toBe(200);
    expect([await level(b), await level(c)]).toEqual([2, 3]);
    // Move to the root: the subtree moves up a level.
    await api.put(`/api/components/${b}`, { token: u.token, json: { parent_component_id: null } });
    expect([await level(b), await level(c)]).toEqual([1, 2]);
    // A cycle is refused.
    const cycle = await api.put(`/api/components/${b}`, { token: u.token, json: { parent_component_id: c } });
    expect(cycle.status).toBe(400);
    expect(cycle.json.error).toMatch(/loop/);
  });

  it('F6.6 delete: subtree by default, or keep the children (they move up); flows go with the step', async () => {
    const p = await createComponent(u, caseId, { component_name: 'Del parent', component_type: 'subprocess' });
    const k1 = await createComponent(u, caseId, { component_name: 'Kid 1', component_type: 'operation', parent_component_id: p });
    const g1 = await createComponent(u, caseId, { component_name: 'Grandkid', component_type: 'elemental_task', parent_component_id: k1 });
    const electricity = Number((await sqlOne(`SELECT substance_id FROM substances WHERE substance_name = 'Electricity'`)).substance_id);
    await api.post(`/api/components/${g1}/flows`, { token: u.token, json: { substance_id: electricity, flow_type: 'input', quantity: 1, unit: 'kWh' } });

    const keep = await api.delete(`/api/components/${k1}?children=reparent`, { token: u.token });
    expect(keep.status).toBe(200);
    expect(keep.json).toMatchObject({ deleted: 1, reparented: 1 });
    expect(await sqlOne('SELECT parent_component_id, hierarchy_level FROM component WHERE component_id = ?', [g1])).toEqual({
      parent_component_id: p,
      hierarchy_level: 2,
    });

    const all = await api.delete(`/api/components/${p}`, { token: u.token });
    expect(all.status).toBe(200);
    expect(all.json.deleted).toBe(2);
    expect(await sql('SELECT component_id FROM component WHERE component_id IN (?, ?)', [p, g1])).toEqual([]);
    expect(await sql('SELECT flow_id FROM flows WHERE component_id = ?', [g1])).toEqual([]);

    const bad = await api.delete(`/api/components/${g1}?children=everything`, { token: u.token });
    expect(bad.status).toBe(400);
  });

  it('400 for a missing name or type and for a bad type', async () => {
    for (const json of [
      { component_type: 'operation' },
      { component_name: 'x' },
      { component_name: 'x', component_type: 'robot' },
      { component_name: 'x', component_type: 'operation', parent_component_id: 'abc' },
      { component_name: 'x', component_type: 'operation', quantity: 'lots' },
      { component_name: 'x', component_type: 'operation', labor_cost: -5 },
    ]) {
      const r = await api.post(`/api/cases/${caseId}/components`, { token: u.token, json });
      expect(r.status, JSON.stringify(json)).toBe(400);
    }
  });
});
