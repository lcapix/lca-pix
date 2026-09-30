/**
 * F9. Run an assessment -> results, and frozen history: a run's totals,
 * per-step rows, names and export do not change when the case is edited or a
 * step is deleted afterwards (RUN-1, STAGE-2, EXP-1).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { snapshotOf, sql, sqlOne } from '../support/db';
import { addFlow, buildWorld, createCase, createComponent, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

const gwp = (totals: any[]) => totals.find((t) => t.category_name === 'Global Warming');

describe('F9 run an assessment -> results', () => {
  it('F9.1 runs the base case: 201, completed, snapshot with flow detail, goal & scope and data quality', async () => {
    const res = await api.post(`/api/cases/${w.P.base.id}/assessments`, {
      token: w.users.editor.token,
      json: { run_name: 'Assessment', calculation_method: 'CML 2001', region_code: 'US Grid' },
    });
    expect(res.status, res.text).toBe(201);
    expect(res.json.assessment).toMatchObject({ status: 'completed', calculation_method: 'CML 2001', region_code: 'US', executed_by: w.users.editor.id });
    expect(res.json.run_id).toBe(res.json.assessment.run_id);
    expect(res.json.results_source).toBe('snapshot');
    const total = gwp(res.json.total_impacts);
    expect(total.unit).toMatch(/CO2/);
    expect(total.impact_value).toBeGreaterThan(0);
    expect(res.json.goal_scope.functional_unit).toBe('1 ceramic mug (350 ml), at the factory gate');
    expect(res.json.data_quality).toBeTruthy();
    // The breakdown lists the steps that carry flows.
    expect(res.json.component_breakdown.map((c: any) => c.component_name).sort()).toEqual([`Mold Cleaning ${w.tag}`, `Mold Filling ${w.tag}`]);

    // The snapshot's flow detail explains the total: each row is amount x factor.
    const snap = await snapshotOf(res.json.run_id);
    const gwRows = snap.flow_detail.filter((r: any) => r.category_name === 'Global Warming');
    expect(gwRows.map((r: any) => r.substance).sort()).toEqual(['Electricity', 'Natural Gas']);
    for (const r of gwRows) {
      const factor = await sqlOne(
        `SELECT d.factor_value FROM driver_impact_factors d JOIN substances s ON s.substance_id = d.substance_id
          JOIN impact_categories ic ON ic.category_id = d.category_id
         WHERE s.substance_name = ? AND ic.category_name = 'Global Warming' AND d.method_name = 'CML 2001' AND d.geographic_scope = ?`,
        [r.substance, r.scope],
      );
      expect(Number(factor.factor_value), `${r.substance} factor from the library`).toBeCloseTo(Number(r.factor), 12);
      expect(Number(r.impact)).toBeCloseTo(Number(r.amount) * Number(r.conversion ?? 1) * Number(r.factor), 9);
    }
    const sum = gwRows.reduce((s: number, r: any) => s + Number(r.impact), 0);
    expect(total.impact_value).toBeCloseTo(sum, 9);
  });

  it('F9.2/F9.6 results reads agree with the run', async () => {
    const run = await api.post(`/api/cases/${w.P.base.id}/assessments`, { token: w.users.owner.token, json: {} });
    const runId = run.json.run_id;
    const list = await api.get(`/api/cases/${w.P.base.id}/assessments`, { token: w.users.viewer.token });
    expect(list.status).toBe(200);
    const latest = list.json.assessments.find((a: any) => a.run_id === runId);
    expect(latest.results_source).toBe('snapshot');
    expect(latest.flowDetail.length).toBeGreaterThan(0);
    expect(latest.componentBreakdown.map((c: any) => c.component_name)).toContain(`Mold Cleaning ${w.tag}`);
    expect(latest.goal_scope.functional_unit).toBe('1 ceramic mug (350 ml), at the factory gate');
    expect(latest.run_snapshot).toBeUndefined();

    const one = await api.get(`/api/assessments/${runId}`, { token: w.users.viewer.token });
    expect(one.status).toBe(200);
    expect(gwp(one.json.total_impacts).impact_value).toBeCloseTo(gwp(run.json.total_impacts).impact_value, 12);
    expect(one.json.results_source).toBe('snapshot');
  });

  // BUG (app/api/cases/[caseId]/assessments/route.ts GET orders by run_date
  // only; run_date has one-second precision): two runs in the same second come
  // back oldest first, and the results page, which shows assessments[0] as
  // "LATEST RUN", shows the older one. The compare route already breaks the
  // tie with run_id DESC. Low severity.
  it.fails('lists the newest run first even when two runs share a second', async () => {
    const t = w.users.owner.token;
    const a = await api.post(`/api/cases/${w.P.base.id}/assessments`, { token: t, json: {} });
    const b = await api.post(`/api/cases/${w.P.base.id}/assessments`, { token: t, json: {} });
    // Two clicks inside one second: make the tie deterministic.
    await sql('UPDATE assessment_runs SET run_date = ? WHERE run_id IN (?, ?)', ['2026-09-30 12:00:00', a.json.run_id, b.json.run_id]);
    await sql('UPDATE assessment_runs SET run_date = ? WHERE case_id = ? AND run_id NOT IN (?, ?)', ['2026-09-30 11:00:00', w.P.base.id, a.json.run_id, b.json.run_id]);
    const list = await api.get(`/api/cases/${w.P.base.id}/assessments`, { token: t });
    expect(list.json.assessments[0].run_id).toBe(b.json.run_id);
  });

  it('400 for an unknown method (RUN-6 fixed) and a non-string field; 403 for a viewer', async () => {
    const t = w.users.editor.token;
    const bad = await api.post(`/api/cases/${w.P.base.id}/assessments`, { token: t, json: { calculation_method: 'Guesswork 1.0' } });
    expect(bad.status).toBe(400);
    expect(bad.json.supported_methods).toEqual(expect.arrayContaining(['CML 2001', 'TRACI 2.1']));
    expect((await api.post(`/api/cases/${w.P.base.id}/assessments`, { token: t, json: { region_code: { US: 1 } } })).status).toBe(400);
    expect((await api.post(`/api/cases/${w.P.base.id}/assessments`, { token: t, raw: '[1,2]' })).status).toBe(400);
    expect((await api.post(`/api/cases/${w.P.base.id}/assessments`, { token: w.users.viewer.token, json: {} })).status).toBe(403);
  });

  it('F9.5 a case with no flows runs with the zero-inventory warning, kept in the snapshot', async () => {
    const empty = await createCase(w.users.owner, w.P.id, `No flows ${w.tag}`, 'comparative');
    await createComponent(w.users.owner, empty, { component_name: 'Lonely product', component_type: 'product' });
    const res = await api.post(`/api/cases/${empty}/assessments`, { token: w.users.owner.token, json: {} });
    expect(res.status).toBe(201);
    expect(res.json.warnings.join(' ')).toMatch(/No process step in this case has any input or output flows yet/);
    const list = await api.get(`/api/cases/${empty}/assessments`, { token: w.users.owner.token });
    expect(list.json.assessments[0].warnings.join(' ')).toMatch(/No process step/);
  });

  it('small values survive storage and reads (RUN-2 fixed)', async () => {
    const tiny = await createCase(w.users.owner, w.P.id, `Tiny ${w.tag}`, 'comparative');
    const leaf = await createComponent(w.users.owner, tiny, { component_name: 'Tiny step', component_type: 'product' });
    await addFlow(w.users.owner, leaf, { substance_id: w.substances.electricity, flow_type: 'input', quantity: 2e-8, unit: 'kWh' });
    const res = await api.post(`/api/cases/${tiny}/assessments`, { token: w.users.owner.token, json: {} });
    const value = gwp(res.json.total_impacts).impact_value;
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1e-6);
    const stored = await sqlOne(
      `SELECT SUM(ar.impact_value) AS v FROM assessment_results ar JOIN impact_categories ic ON ic.category_id = ar.category_id
        WHERE ar.run_id = ? AND ic.category_name = 'Global Warming'`,
      [res.json.run_id],
    );
    expect(Number(stored.v)).toBeCloseTo(value, 20);
    const read = await api.get(`/api/assessments/${res.json.run_id}`, { token: w.users.owner.token });
    expect(gwp(read.json.total_impacts).impact_value).toBeCloseTo(value, 20);
  });

  it('frozen history: rename, edit a flow, change a stage, delete a step -> the run reads and exports the same', async () => {
    const owner = w.users.owner;
    const caseId = await w.fresh.caseCopy();
    const steps = await sql<{ component_id: number; component_name: string }>(
      'SELECT component_id, component_name FROM component WHERE case_id = ? ORDER BY hierarchy_level',
      [caseId],
    );
    const run = await api.post(`/api/cases/${caseId}/assessments`, { token: owner.token, json: {} });
    expect(run.status).toBe(201);
    const runId = run.json.run_id;

    const capture = async () => {
      const one = await api.get(`/api/assessments/${runId}`, { token: owner.token });
      const list = await api.get(`/api/cases/${caseId}/assessments`, { token: owner.token });
      const csv = await api.get(`/api/assessments/${runId}/export?format=csv`, { token: owner.token });
      const entry = list.json.assessments.find((a: any) => a.run_id === runId);
      return {
        totals: one.json.total_impacts,
        breakdown: one.json.component_breakdown,
        results: one.json.results,
        impacts: entry.impacts,
        componentBreakdown: entry.componentBreakdown,
        flowDetail: entry.flowDetail,
        csv: csv.text.split('\n').filter((l) => !l.startsWith('# Exported:')).join('\n'),
      };
    };
    const before = await capture();

    const [product, line, , op, task] = steps;
    expect((await api.put(`/api/components/${line.component_id}`, { token: owner.token, json: { component_name: 'Renamed line' } })).status).toBe(200);
    expect((await api.put(`/api/components/${op.component_id}`, { token: owner.token, json: { life_cycle_stage: 'end_of_life' } })).status).toBe(200);
    const [flow] = await sql('SELECT flow_id FROM flows WHERE component_id = ?', [op.component_id]);
    expect((await api.put(`/api/flows/${flow.flow_id}`, { token: owner.token, json: { quantity: 99 } })).status).toBe(200);
    expect((await api.delete(`/api/components/${task.component_id}`, { token: owner.token })).status).toBe(200);
    expect(product).toBeTruthy();

    const after = await capture();
    expect(after).toEqual(before);
    // The deleted step's stored result rows survive, detached (ON DELETE SET NULL).
    const orphaned = await sql('SELECT COUNT(*) AS n FROM assessment_results WHERE run_id = ? AND component_id IS NULL', [runId]);
    expect(Number(orphaned[0].n)).toBeGreaterThan(0);
  });
});
