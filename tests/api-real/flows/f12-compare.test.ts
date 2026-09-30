/**
 * F12. Comparative case: duplicate, clone from base, scale -> compare.
 * A case that cannot be ranked (no flows, no run) is "incomplete" and never
 * ranked; the UI labels it "Incomplete — not ranked".
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql, sqlOne } from '../support/db';
import { buildWorld, createCase, createComponent, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld();
});

const gw = (c: any) => c.totals.find((t: any) => t.category === 'Global Warming');

describe('F12 comparative case -> compare', () => {
  it('F12.1 duplicate is a deep copy: tree with remapped parents, flows, costs, stage, transport leg, reference flow', async () => {
    const owner = w.users.owner;
    await api.put(`/api/components/${w.P.base.op}`, { token: owner.token, json: { labor_cost: 7.5, life_cycle_stage: 'production' } });
    await api.put(`/api/cases/${w.P.base.id}`, { token: owner.token, json: { reference_flow: 2, reference_flow_unit: 'mug' } });
    const truck = Number((await sqlOne(`SELECT substance_id FROM substances WHERE substance_name = 'Transport, truck, regional'`)).substance_id);
    await api.post(`/api/components/${w.P.base.task}/flows`, {
      token: owner.token,
      json: { substance_id: truck, flow_type: 'input', quantity: 382.5, unit: 'tkm', transport_mass_kg: 850, transport_distance_km: 450 },
    });

    const res = await api.post(`/api/cases/${w.P.base.id}/duplicate`, { token: w.users.editor.token, json: { case_name: `Kiln upgrade ${w.tag}` } });
    expect(res.status, res.text).toBe(201);
    expect(res.json).toMatchObject({ case_type: 'comparative', components_copied: 5, flows_copied: 3 });
    const copy = Number(res.json.case_id);

    const tree = async (caseId: number) =>
      sql(
        `SELECT c.component_name, c.component_type, c.hierarchy_level, c.labor_cost, c.life_cycle_stage, p.component_name AS parent
           FROM component c LEFT JOIN component p ON p.component_id = c.parent_component_id
          WHERE c.case_id = ? ORDER BY c.hierarchy_level`,
        [caseId],
      );
    expect(await tree(copy)).toEqual(await tree(w.P.base.id));
    const flows = async (caseId: number) =>
      sql(
        `SELECT c.component_name, f.substance_id, f.flow_type, f.quantity, f.unit, f.transport_mass_kg, f.transport_distance_km
           FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ? ORDER BY c.component_name, f.substance_id`,
        [caseId],
      );
    expect(await flows(copy)).toEqual(await flows(w.P.base.id));
    // Parents point inside the copy.
    const foreign = await sql(
      `SELECT c.component_id FROM component c JOIN component p ON p.component_id = c.parent_component_id WHERE c.case_id = ? AND p.case_id <> ?`,
      [copy, copy],
    );
    expect(foreign).toEqual([]);
    expect(await sqlOne('SELECT reference_flow, reference_flow_unit FROM case_table WHERE case_id = ?', [copy])).toEqual({
      reference_flow: '2.000000',
      reference_flow_unit: 'mug',
    });
    // Runs are the original's history, not copied.
    expect(await sql('SELECT run_id FROM assessment_runs WHERE case_id = ?', [copy])).toEqual([]);

    // Errors: a name clash, an empty source.
    expect((await api.post(`/api/cases/${w.P.base.id}/duplicate`, { token: owner.token, json: { case_name: `kiln UPGRADE ${w.tag}` } })).status).toBe(409);
    const empty = await createCase(owner, w.P.id, `Empty src ${w.tag}`, 'comparative');
    expect((await api.post(`/api/cases/${empty}/duplicate`, { token: owner.token, json: {} })).status).toBe(400);
  });

  it('F12.1 duplicate a case whose steps carry drivers JSON (CMP-1 fixed)', async () => {
    const c = await createCase(w.users.owner, w.P.id, `Drivers ${w.tag}`, 'comparative');
    await createComponent(w.users.owner, c, { component_name: 'Driven', component_type: 'product', drivers: [{ name: 'kWh', value: 3 }] });
    const res = await api.post(`/api/cases/${c}/duplicate`, { token: w.users.owner.token, json: {} });
    expect(res.status, res.text).toBe(201);
    expect(res.json.case_name).toBe(`Drivers ${w.tag} (Copy)`);
    const drivers = await sqlOne('SELECT drivers FROM component WHERE case_id = ?', [res.json.case_id]);
    expect(drivers.drivers).toEqual([{ name: 'kWh', value: 3 }]);
  });

  it('F12.3 clone-from copies components and flows into an empty case; 409 when not empty; 400 across projects', async () => {
    const target = await w.fresh.emptyCase();
    const res = await api.post(`/api/cases/${target}/clone-from`, { token: w.users.editor.token, json: { sourceCaseId: w.P.base.id } });
    expect(res.status, res.text).toBe(200);
    expect(res.json.cloned).toBeGreaterThanOrEqual(5);
    expect(res.json.flows_copied).toBeGreaterThanOrEqual(2);
    const n = await sqlOne('SELECT COUNT(*) AS n FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ?', [target]);
    expect(Number(n.n)).toBe(res.json.flows_copied);

    const again = await api.post(`/api/cases/${target}/clone-from`, { token: w.users.editor.token, json: { sourceCaseId: w.P.base.id } });
    expect(again.status).toBe(409);
    const otherProject = await api.post(`/api/cases/${await w.fresh.emptyCase()}/clone-from`, {
      token: w.users.owner.token,
      json: { sourceCaseId: w.Q.caseId },
    });
    expect(otherProject.status).toBe(400);
    expect(otherProject.json.error).toBe('Cases must belong to the same project');
    expect((await api.post(`/api/cases/${target}/clone-from`, { token: w.users.owner.token, json: {} })).status).toBe(400);
  });

  it('F12.6 compare: both runs on the same basis, the copy lower, the delta negative', async () => {
    const res = await api.get(`/api/projects/${w.P.id}/compare?cases=${w.P.base.id},${w.P.comp.id}`, { token: w.users.viewer.token });
    expect(res.status, res.text).toBe(200);
    expect(res.json.baseCaseId).toBe(String(w.P.base.id));
    const [base, comp] = res.json.cases;
    expect(base).toMatchObject({ isBase: true, name: w.P.base.name });
    expect(comp).toMatchObject({ isBase: false, name: w.P.comp.name });
    expect(base.run).toMatchObject({ runId: w.P.base.run, method: 'CML 2001', region: 'US', hasSnapshot: true, resultsSource: 'snapshot' });
    expect(comp.run).toMatchObject({ runId: w.P.comp.run, method: 'CML 2001', region: 'US' });
    const b = gw(base).value;
    const c = gw(comp).value;
    expect(b).toBeGreaterThan(0);
    expect(c).toBeLessThan(b);
    // Same numbers as the runs themselves (per functional unit, scale 1).
    const baseRun = await api.get(`/api/assessments/${w.P.base.run}`, { token: w.users.viewer.token });
    expect(baseRun.json.total_impacts.find((t: any) => t.category_name === 'Global Warming').impact_value).toBeCloseTo(b, 12);
    expect((c - b) / b).toBeLessThan(0);
    // What differs: the two lowered flows.
    const diff = res.json.diffs.find((d: any) => d.caseId === String(w.P.comp.id));
    expect(JSON.stringify(diff.inventory)).toMatch(/Electricity/);
  });

  it('a case with no flows, or no run, is "incomplete" and never ranked; an edited one is "stale"', async () => {
    const owner = w.users.owner;
    const noFlows = await createCase(owner, w.P.id, `Zero flows ${w.tag}`, 'comparative');
    await createComponent(owner, noFlows, { component_name: 'Bare product', component_type: 'product' });
    await api.post(`/api/cases/${noFlows}/assessments`, { token: owner.token, json: {} });
    const notRun = await w.fresh.caseCopy();

    const res = await api.get(`/api/projects/${w.P.id}/compare?cases=${w.P.base.id},${noFlows},${notRun}`, { token: owner.token });
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.json.cases.map((c: any) => [c.caseId, c]));
    expect(byId[String(noFlows)]).toMatchObject({ status: 'incomplete', statusReason: 'No flows yet' });
    expect(byId[String(notRun)]).toMatchObject({ status: 'incomplete', statusReason: 'Not run yet', totals: [] });

    // Edit the copy after its run: stale, not ranked on old numbers.
    const [flow] = await sql('SELECT f.flow_id FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ? LIMIT 1', [w.P.comp.id]);
    await sql('UPDATE assessment_runs SET run_date = run_date - INTERVAL 5 SECOND WHERE run_id = ?', [w.P.comp.run]);
    await api.put(`/api/flows/${flow.flow_id}`, { token: owner.token, json: { quantity: 1.2 } });
    const stale = await api.get(`/api/projects/${w.P.id}/compare?cases=${w.P.base.id},${w.P.comp.id}`, { token: owner.token });
    expect(stale.json.cases[1]).toMatchObject({ status: 'stale', statusReason: 'Edited after this run' });
    expect(stale.json.cases[1].run.stale).toBe(true);
  });

  it('compare refuses no cases (400) and cases outside the project (404)', async () => {
    const t = w.users.viewer.token;
    expect((await api.get(`/api/projects/${w.P.id}/compare`, { token: t })).status).toBe(400);
    expect((await api.get(`/api/projects/${w.P.id}/compare?cases=abc`, { token: t })).status).toBe(400);
    const outside = await api.get(`/api/projects/${w.P.id}/compare?cases=${w.Q.caseId}`, { token: t });
    expect(outside.status).toBe(404);
    expect(outside.json).toEqual({ error: 'No such cases in this project' });
  });

  it('the legacy comparisons POST validates and saves nothing (CMP-7)', async () => {
    const before = await sqlOne('SELECT COUNT(*) AS n FROM comparison_runs');
    const res = await api.post('/api/comparisons', {
      token: w.users.viewer.token,
      json: { comparison_name: 'Legacy', project_id: w.P.id, case_ids: [w.P.base.id, w.P.comp.id] },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ saved: false, case_ids: [w.P.base.id, w.P.comp.id] });
    expect(await sqlOne('SELECT COUNT(*) AS n FROM comparison_runs')).toEqual(before);
    const list = await api.get(`/api/comparisons?project_id=${w.P.id}`, { token: w.users.viewer.token });
    expect(list.json.comparisons.map((c: any) => c.comparison_id)).toContain(w.legacyComparison);
    const one = await api.get(`/api/comparisons/${w.legacyComparison}`, { token: w.users.viewer.token });
    expect(one.json.comparison.case_ids).toEqual([w.P.base.id, w.P.comp.id]);
  });
});
