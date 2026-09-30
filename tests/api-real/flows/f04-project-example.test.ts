/**
 * F4. Create a project (method, region, functional unit), start a case; and
 * F4b, the worked example.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { createUser, type TestUser } from '../support/users';

let u: TestUser;
beforeAll(async () => {
  u = await createUser('f4');
});

describe('F4 create a project', () => {
  it('F4.3-F4.6 creates the project, sets the study scope, starts an empty case and loads the workspace', async () => {
    const name = `Bike frame study ${u.id}`;
    const created = await api.post('/api/projects', { token: u.token, json: { project_name: name, description: 'Compare frames' } });
    expect(created.status).toBe(201);
    const pid = Number(created.json.project.project_id);
    expect(created.json.project).toMatchObject({ project_name: name, owner_id: u.id, owner_username: u.username });

    // One owner membership row, as the creator.
    const members = await sql(
      `SELECT pm.user_id, p.permission_name FROM project_members pm JOIN permissions p ON p.permission_id = pm.permission_id WHERE pm.project_id = ?`,
      [pid],
    );
    expect(members).toEqual([{ user_id: u.id, permission_name: 'owner' }]);

    // F4.4 the settings PUT the form sends right after.
    const put = await api.put(`/api/projects/${pid}`, {
      token: u.token,
      json: {
        lcia_method: 'TRACI 2.1',
        region_code: 'US Grid',
        functional_unit: '1 bike frame, at the gate',
        system_boundary: 'cradle-to-gate',
        goal_statement: 'Compare frames',
      },
    });
    expect(put.status).toBe(200);
    expect(put.json.project).toMatchObject({
      lcia_method: 'TRACI 2.1',
      region_code: 'US',
      functional_unit: '1 bike frame, at the gate',
      system_boundary: 'cradle-to-gate',
      goal_statement: 'Compare frames',
    });

    // F4.5 start an empty case.
    const c = await api.post(`/api/projects/${pid}/cases`, {
      token: u.token,
      json: { case_name: 'Base case', case_type: 'base', description: 'Built by hand' },
    });
    expect(c.status).toBe(201);
    const caseId = Number(c.json.case.case_id);

    // F4.6 the workspace reads.
    const project = await api.get(`/api/projects/${pid}`, { token: u.token });
    expect(project.status).toBe(200);
    expect(project.json.project.members).toHaveLength(1);
    const cases = await api.get(`/api/projects/${pid}/cases`, { token: u.token });
    expect(cases.json.cases.map((x: any) => [x.case_id, Number(x.component_count), Number(x.run_count)])).toEqual([[caseId, 0, 0]]);
    for (const path of [`/api/cases/${caseId}/components`, `/api/cases/${caseId}/assessments`, `/api/cases/${caseId}/completeness`]) {
      expect((await api.get(path, { token: u.token })).status, path).toBe(200);
    }
    const list = await api.get('/api/projects', { token: u.token });
    expect(list.json.projects.map((p: any) => p.project_id)).toContain(pid);
  });

  it('refuses an empty name (400), a duplicate name for the same owner (409), a bad method or boundary (400)', async () => {
    expect((await api.post('/api/projects', { token: u.token, json: { project_name: '   ' } })).status).toBe(400);
    const name = `Dup study ${u.id}`;
    expect((await api.post('/api/projects', { token: u.token, json: { project_name: name } })).status).toBe(201);
    const dup = await api.post('/api/projects', { token: u.token, json: { project_name: `  ${name.toUpperCase()} ` } });
    expect(dup.status).toBe(409);
    // Another owner may use the same name.
    const other = await createUser('f4other');
    expect((await api.post('/api/projects', { token: other.token, json: { project_name: name } })).status).toBe(201);

    const pid = Number((await api.post('/api/projects', { token: u.token, json: { project_name: `Scope ${u.id}` } })).json.project.project_id);
    const badMethod = await api.put(`/api/projects/${pid}`, { token: u.token, json: { lcia_method: 'EF 3.1' } });
    expect(badMethod.status).toBe(400);
    const badBoundary = await api.put(`/api/projects/${pid}`, { token: u.token, json: { system_boundary: 'grave-to-cradle' } });
    expect(badBoundary.status).toBe(400);
    const row = await sqlOne('SELECT lcia_method, system_boundary FROM project WHERE project_id = ?', [pid]);
    expect(row).toEqual({ lcia_method: null, system_boundary: 'cradle-to-gate' });
  });

  it('only the owner deletes the project; the delete cascades', async () => {
    const pid = Number((await api.post('/api/projects', { token: u.token, json: { project_name: `Doomed ${u.id}` } })).json.project.project_id);
    const caseId = Number((await api.post(`/api/projects/${pid}/cases`, { token: u.token, json: { case_name: 'c', case_type: 'base' } })).json.case.case_id);
    const del = await api.delete(`/api/projects/${pid}`, { token: u.token });
    expect(del.status).toBe(200);
    expect(await sql('SELECT project_id FROM project WHERE project_id = ?', [pid])).toEqual([]);
    expect(await sql('SELECT case_id FROM case_table WHERE case_id = ?', [caseId])).toEqual([]);
    expect(await sql('SELECT member_id FROM project_members WHERE project_id = ?', [pid])).toEqual([]);
  });
});

describe('F4b worked example', () => {
  it('builds the example with its functional unit (PROJ-1 fixed), runs it, and a repeat returns existed:true', async () => {
    const first = await api.post('/api/example-project', { token: u.token });
    expect(first.status).toBe(200);
    const pid = Number(first.json.project_id);
    const caseId = Number(first.json.case_id);

    const project = await sqlOne('SELECT project_name, owner_id, lcia_method, region_code, functional_unit, system_boundary FROM project WHERE project_id = ?', [pid]);
    expect(project).toMatchObject({
      project_name: 'Example: painted steel bracket',
      owner_id: u.id,
      lcia_method: 'TRACI 2.1',
      region_code: 'US',
      functional_unit: '1 painted steel bracket, at the factory gate',
    });
    const owners = await sql(
      `SELECT pm.user_id FROM project_members pm JOIN permissions p ON p.permission_id = pm.permission_id
        WHERE pm.project_id = ? AND p.permission_name = 'owner'`,
      [pid],
    );
    expect(owners).toEqual([{ user_id: u.id }]);
    const steps = await sql('SELECT component_type, life_cycle_stage FROM component WHERE case_id = ? ORDER BY component_id', [caseId]);
    expect(steps.map((s: any) => s.component_type)).toEqual(['product', 'operation', 'operation', 'operation']);
    const flows = await sql(
      'SELECT s.substance_name, f.quantity, f.unit FROM flows f JOIN component c ON c.component_id = f.component_id JOIN substances s ON s.substance_id = f.substance_id WHERE c.case_id = ?',
      [caseId],
    );
    expect(flows.length).toBeGreaterThanOrEqual(4);

    // With the functional unit set, the run the UI gates on works.
    const run = await api.post(`/api/cases/${caseId}/assessments`, { token: u.token, json: {} });
    expect(run.status).toBe(201);
    expect(run.json.assessment.calculation_method).toBe('TRACI 2.1');
    expect(run.json.goal_scope.functional_unit).toBe('1 painted steel bracket, at the factory gate');

    const again = await api.post('/api/example-project', { token: u.token });
    expect(again.status).toBe(200);
    expect(again.json).toMatchObject({ existed: true, project_id: pid });
    expect((await sql('SELECT COUNT(*) AS n FROM project WHERE owner_id = ? AND project_name = ?', [u.id, 'Example: painted steel bracket']))[0].n).toBe(1);
  });

  // BUG (lib/example-case.ts:89 names 'Argon', which neither db/baseline nor
  // any migration seeds; migrate-023 only uses it as a substance hint): the
  // worked example always answers skipped_substances ['Argon'], so the weld
  // step has no argon flow and the point the example makes about a substance
  // without a climate factor ("the run says so") never shows. Low severity.
  it.fails('builds every flow of the worked example, argon included', async () => {
    const other = await createUser('f4argon');
    const res = await api.post('/api/example-project', { token: other.token });
    expect(res.status).toBe(200);
    expect(res.json.skipped_substances).toEqual([]);
  });
});
