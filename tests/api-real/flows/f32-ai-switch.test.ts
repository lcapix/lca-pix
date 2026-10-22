/**
 * F32. The AI switch per project (D7, migrate-042): on by default; only the
 * owner switches it, each change audited; off means Magic Insights answers
 * with the computed insight and nothing is sent to the model.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql } from '../support/db';
import { hfStream, mockOutbound, outbound } from '../support/outbound';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: true });
});
beforeEach(async () => {
  process.env.HF_TOKEN = 'hf_test_dummy_token';
  await sql('DELETE FROM insight_cache');
});
afterEach(() => {
  delete process.env.HF_TOKEN;
});

const facts = () => ({
  run_id: w.P.base.run,
  caseName: 'Standard Production',
  method: 'CML 2001',
  categoryLabel: 'Global Warming',
  total: { value: 6.09, unit: 'kg CO2 eq' },
  contributors: [{ name: 'Mold Cleaning', pct: 58.1, value: 3.54, unit: 'kg CO2 eq' }],
  materials: [],
  levers: [],
  mode: 'summary',
  allCategories: [],
});
const hfCalls = () => outbound.calls.filter((c) => c.url.includes('huggingface')).length;

describe('F32 AI switch', () => {
  it('is on by default and readable by members', async () => {
    const got = await api.get(`/api/projects/${w.P.id}`, { token: w.users.viewer.token });
    expect(got.json.project.ai_enabled).toBe(true);
  });

  it('only the owner switches it: admin and editor 403, a bad value 400, nothing written', async () => {
    for (const [u, status] of [[w.users.adminm, 403], [w.users.editor, 403], [w.users.nonmem, 404]] as const) {
      expect((await api.put(`/api/projects/${w.P.id}`, { token: u.token, json: { ai_enabled: false } })).status, u.label).toBe(status);
    }
    for (const bad of ['no', 2, null]) {
      expect((await api.put(`/api/projects/${w.P.id}`, { token: w.users.owner.token, json: { ai_enabled: bad } })).status, String(bad)).toBe(400);
    }
    expect((await sql<any>('SELECT ai_enabled FROM project WHERE project_id = ?', [w.P.id]))[0].ai_enabled).toBe(1);
  });

  it('off: the computed insight, no model call; the change is audited once; on again narrates', async () => {
    expect((await api.put(`/api/projects/${w.P.id}`, { token: w.users.owner.token, json: { ai_enabled: false } })).status).toBe(200);
    expect((await api.put(`/api/projects/${w.P.id}`, { token: w.users.owner.token, json: { ai_enabled: false } })).status).toBe(200);
    const audit = await sql<any>(
      `SELECT action_type, old_values, new_values FROM audit_log WHERE table_name = 'project' AND record_id = ? ORDER BY log_id`,
      [w.P.id],
    );
    expect(audit.filter((a: any) => 'ai_enabled' in (a.new_values ?? {}))).toEqual([
      { action_type: 'update', old_values: { ai_enabled: true }, new_values: { ai_enabled: false } },
    ]);

    const before = hfCalls();
    mockOutbound(/router\.huggingface\.co/, () => hfStream(['Mold Cleaning is 58.1% of it.']));
    const off = await api.post('/api/insights', { token: w.users.editor.token, json: facts() });
    expect(off.status).toBe(200);
    expect(off.json).toMatchObject({ fallback: true, ai: 'off' });
    expect(hfCalls()).toBe(before);

    expect((await api.put(`/api/projects/${w.P.id}`, { token: w.users.owner.token, json: { ai_enabled: true } })).status).toBe(200);
    mockOutbound(/router\.huggingface\.co/, () => hfStream(['Mold Cleaning is 58.1% of it.']));
    const on = await api.post('/api/insights', { token: w.users.editor.token, json: facts() });
    expect(on.status).toBe(200);
    expect(on.text).toBe('Mold Cleaning is 58.1% of it.');
    expect(on.headers.get('x-insights-cache')).toBe('miss');
    // Asked again: read back from the cache, no second model call.
    const again = await api.post('/api/insights', { token: w.users.viewer.token, json: facts() });
    expect(again.headers.get('x-insights-cache')).toBe('hit');
    expect(hfCalls()).toBe(before + 1);
  });

  it("another tenant's run is 404 and nothing is sent", async () => {
    const before = hfCalls();
    const res = await api.post('/api/insights', { token: w.users.editor.token, json: { ...facts(), run_id: w.Q.run } });
    expect(res.status).toBe(404);
    expect(hfCalls()).toBe(before);
  });
});
