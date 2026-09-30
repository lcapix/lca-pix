/**
 * F5. Goal & scope (ISO 14044 phase 1): the study fields on the project, the
 * reference flow and data basis on the case, and the snapshot a run freezes.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sqlOne } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

describe('F5 goal & scope', () => {
  it('F5.3 saves the study and case fields; the product quantity follows the data basis; the run freezes them', async () => {
    const owner = w.users.owner;
    const projectPut = await api.put(`/api/projects/${w.P.id}`, {
      token: owner.token,
      json: {
        functional_unit: '1 ceramic mug (350 ml), at the factory gate',
        system_boundary: 'gate-to-gate',
        goal_statement: 'Find the hotspot of mug production',
        boundary_notes: 'Packaging excluded',
      },
    });
    expect(projectPut.status).toBe(200);
    const casePut = await api.put(`/api/cases/${w.P.base.id}`, {
      token: owner.token,
      json: { reference_flow: 1, reference_flow_unit: 'mug', modeled_output: 100 },
    });
    expect(casePut.status).toBe(200);
    expect(casePut.json.case).toMatchObject({ reference_flow_unit: 'mug' });
    expect(Number(casePut.json.case.modeled_output)).toBe(100);

    const product = await sqlOne('SELECT quantity FROM component WHERE component_id = ?', [w.P.base.product]);
    expect(Number(product.quantity)).toBe(100);

    const project = await sqlOne('SELECT functional_unit, system_boundary, goal_statement, boundary_notes FROM project WHERE project_id = ?', [w.P.id]);
    expect(project).toEqual({
      functional_unit: '1 ceramic mug (350 ml), at the factory gate',
      system_boundary: 'gate-to-gate',
      goal_statement: 'Find the hotspot of mug production',
      boundary_notes: 'Packaging excluded',
    });

    const run = await api.post(`/api/cases/${w.P.base.id}/assessments`, { token: owner.token, json: {} });
    expect(run.status).toBe(201);
    expect(run.json.goal_scope).toMatchObject({
      functional_unit: '1 ceramic mug (350 ml), at the factory gate',
      system_boundary: 'gate-to-gate',
      reference_flow_unit: 'mug',
    });
    expect(Number(run.json.goal_scope.modeled_output)).toBe(100);
    expect(Number(run.json.goal_scope.per_fu_scale)).toBeCloseTo(0.01, 12);
    // A run with no method named uses the study's method and region.
    expect(run.json.assessment).toMatchObject({ calculation_method: 'CML 2001', region_code: 'US' });
  });

  it('an editor saves the case half but not the study half (partial save, F5 edge case)', async () => {
    const editor = w.users.editor;
    const p = await api.put(`/api/projects/${w.P.id}`, { token: editor.token, json: { functional_unit: 'editor FU' } });
    expect(p.status).toBe(403);
    const c = await api.put(`/api/cases/${w.P.base.id}`, { token: editor.token, json: { reference_flow: 2 } });
    expect(c.status).toBe(200);
    expect((await sqlOne('SELECT functional_unit FROM project WHERE project_id = ?', [w.P.id])).functional_unit).not.toBe('editor FU');
  });

  it('a viewer gets 403 on both halves', async () => {
    const t = w.users.viewer.token;
    expect((await api.put(`/api/projects/${w.P.id}`, { token: t, json: { functional_unit: 'x' } })).status).toBe(403);
    expect((await api.put(`/api/cases/${w.P.base.id}`, { token: t, json: { reference_flow: 3 } })).status).toBe(403);
  });

  it('400 for a reference flow or data basis that is not a positive number, and for a bad boundary', async () => {
    const t = w.users.owner.token;
    for (const body of [{ reference_flow: 0 }, { reference_flow: -1 }, { modeled_output: 'abc' }, { modeled_output: 1e309 }]) {
      const r = await api.put(`/api/cases/${w.P.base.id}`, { token: t, raw: JSON.stringify(body).replace('null', '1e309') });
      expect(r.status, JSON.stringify(body)).toBe(400);
    }
    const r = await api.put(`/api/projects/${w.P.id}`, { token: t, json: { system_boundary: 'everything' } });
    expect(r.status).toBe(400);
  });
});
