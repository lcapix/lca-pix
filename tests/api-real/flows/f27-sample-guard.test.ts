/**
 * F27. The sample's read-only base case (migrate-038): nobody changes it, its
 * owner included, through any route; reading and "Make my own copy" stay open;
 * the copy is editable; a hidden case still answers 404, not the read-only 403.
 * The flags are set here by SQL; the sample builder (2.9) sets them in use.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne, tableChecksums } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: true });
  await sql('UPDATE case_table SET read_only = 1 WHERE case_id = ?', [w.P.base.id]);
  await sql('UPDATE project SET is_sample = 1 WHERE project_id = ?', [w.P.id]);
});

const RO = 'This case is read-only. Make your own copy to change it.';

describe('F27 sample guard', () => {
  it('reads stay open and say read-only; the owner reads it as "Can read"', async () => {
    const got = await api.get(`/api/cases/${w.P.base.id}`, { token: w.users.owner.token });
    expect(got.status).toBe(200);
    expect(got.json.case).toMatchObject({ read_only: true, my_role: 'viewer' });
    for (const url of [`/api/cases/${w.P.base.id}/components`, `/api/components/${w.P.base.task}/flows`, `/api/cases/${w.P.base.id}/assessments`, `/api/components/${w.P.base.op}/costs`]) {
      expect((await api.get(url, { token: w.users.editor.token })).status, url).toBe(200);
    }
  });

  it('every change is 403 with one message, for the owner too, and writes nothing', async () => {
    const t = w.users.owner.token;
    const attempts: Array<[string, () => Promise<any>]> = [
      ['rename', () => api.put(`/api/cases/${w.P.base.id}`, { token: t, json: { case_name: 'changed' } })],
      ['write-up', () => api.put(`/api/cases/${w.P.base.id}`, { token: t, json: { interpretation: 'mine' } })],
      ['delete case', () => api.delete(`/api/cases/${w.P.base.id}`, { token: t })],
      ['add step', () => api.post(`/api/cases/${w.P.base.id}/components`, { token: t, json: { component_name: 'x', component_type: 'operation', parent_component_id: w.P.base.subprocess } })],
      ['edit step', () => api.put(`/api/components/${w.P.base.op}`, { token: t, json: { component_name: 'x' } })],
      ['delete step', () => api.delete(`/api/components/${w.P.base.task}`, { token: t })],
      ['add flow', () => api.post(`/api/components/${w.P.base.task}/flows`, { token: t, json: { substance_id: w.substances.steel, flow_type: 'input', quantity: 1, unit: 'kg' } })],
      ['edit flow', () => api.put(`/api/flows/${w.P.base.flow}`, { token: t, json: { quantity: 9 } })],
      ['delete flow', () => api.delete(`/api/flows/${w.P.base.flow}`, { token: t })],
      ['own factor', () => api.put(`/api/flows/${w.P.base.flow}/factor`, { token: t, json: { category_id: 1, factor_value: 1, source: 'x' } })],
      ['step cost', () => api.put(`/api/components/${w.P.base.op}/costs`, { token: t, json: { kind: 'overhead', mode: 'entered', amount: 1 } })],
      ['auto-costs', () => api.post(`/api/components/${w.P.base.op}/auto-costs`, { token: t })],
      ['run', () => api.post(`/api/cases/${w.P.base.id}/assessments`, { token: t, json: { calculation_method: 'CML 2001', region_code: 'US' } })],
      ['scale', () => api.post(`/api/cases/${w.P.base.id}/scale`, { token: t, json: { from: 1, to: 2, mode: 'scale-inputs' } })],
    ];
    for (const [label, attempt] of attempts) {
      const before = await tableChecksums();
      const res = await attempt();
      expect(res.status, `${label}: ${res.text}`).toBe(403);
      expect(res.json.error, label).toBe(RO);
      expect(await tableChecksums(), `${label} wrote`).toEqual(before);
    }
  });

  it('"Make my own copy": the copy is an ordinary, editable case', async () => {
    const t = w.users.editor.token;
    const dup = await api.post(`/api/cases/${w.P.base.id}/duplicate`, { token: t, json: { case_name: `My bracket ${w.tag}` } });
    expect(dup.status, dup.text).toBe(201);
    expect((await sqlOne('SELECT read_only FROM case_table WHERE case_id = ?', [dup.json.case_id])).read_only).toBe(0);
    expect((await api.put(`/api/cases/${dup.json.case_id}`, { token: t, json: { interpretation: 'Cure time is the lever.' } })).status).toBe(200);
    expect((await api.get(`/api/cases/${dup.json.case_id}`, { token: t })).json.case).toMatchObject({ read_only: false, my_role: 'editor' });
  });

  it('a non-member still gets 404, never the read-only 403', async () => {
    const res = await api.put(`/api/cases/${w.P.base.id}`, { token: w.users.nonmem.token, json: { case_name: 'x' } });
    expect(res.status).toBe(404);
  });

  it('the projects list flags the sample; removing it is audited with the flag', async () => {
    const list = await api.get('/api/projects', { token: w.users.owner.token });
    expect(list.json.projects.find((p: any) => p.project_id === w.P.id).is_sample).toBe(true);
    expect(list.json.projects.find((p: any) => p.project_id === w.Q.id)).toBeUndefined();
    const del = await api.delete(`/api/projects/${w.P.id}`, { token: w.users.owner.token });
    expect(del.status, del.text).toBe(200);
    const [row] = await sql<any>(`SELECT action_type, old_values FROM audit_log WHERE table_name = 'project' AND record_id = ? AND action_type = 'delete'`, [w.P.id]);
    expect(row.old_values).toMatchObject({ is_sample: true });
  });
});
