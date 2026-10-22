/**
 * F11. Magic Insights, AI mode: POST /api/insights with the Hugging Face
 * router mocked. The stream starts with a role-only delta, a reasoning-only
 * delta and a keep-alive (what stalled INS-1); the text must still arrive.
 * Limits: 16 KB body, 500-character question, 20 calls per user per hour.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql } from '../support/db';
import { hfStream, mockOutbound, outbound } from '../support/outbound';
import { createUser, type TestUser } from '../support/users';
import { addFlow, buildTree, createCase, createProject, runAssessment, substanceId } from '../support/world';

const FACTS = {
  caseName: 'Standard Production',
  method: 'CML 2001',
  categoryLabel: 'Global Warming',
  total: { value: 6.09, unit: 'kg CO2 eq' },
  contributors: [
    { name: 'Mold Cleaning', pct: 58.1, value: 3.54, unit: 'kg CO2 eq' },
    { name: 'Mold Filling', pct: 41.9, value: 2.55, unit: 'kg CO2 eq' },
  ],
  materials: [],
  levers: [],
  mode: 'summary',
  allCategories: [],
};

/** A run the user owns: narration is about a run the caller reaches (education 2.13). */
async function ownRun(user: TestUser): Promise<number> {
  const pid = await createProject(user, `Insights ${user.id}`);
  const caseId = await createCase(user, pid, `Insights case ${user.id}`);
  const ids = await buildTree(user, caseId, ['Mug', 'Line', 'Casting', 'Filling', 'Cleaning'].map((n) => `${n} ${user.id}`));
  await addFlow(user, ids[4], { substance_id: await substanceId('Electricity'), flow_type: 'input', quantity: 2.5, unit: 'kWh' });
  return Number((await runAssessment(user, caseId)).run_id);
}

let u: TestUser;
let runId: number;
const facts = () => ({ ...FACTS, run_id: runId });
beforeAll(async () => {
  u = await createUser('f11');
  runId = await ownRun(u);
});
beforeEach(async () => {
  process.env.HF_TOKEN = 'hf_test_dummy_token';
  // Each test asks afresh: a kept reply would answer a repeated prompt.
  await sql('DELETE FROM insight_cache');
});
afterEach(() => {
  delete process.env.HF_TOKEN;
});

describe('F11 Magic Insights (AI mode)', () => {
  it('without HF_TOKEN: 200 {fallback:true}, and nothing leaves the server', async () => {
    delete process.env.HF_TOKEN;
    const res = await api.post('/api/insights', { token: u.token, json: facts() });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ fallback: true, reason: 'HF_TOKEN not configured' });
    expect(outbound.calls).toEqual([]);
  });

  it('streams the narration past role-only, reasoning-only and keep-alive events (INS-1 fixed)', async () => {
    const res = await api.post('/api/insights', { token: u.token, json: facts() });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('x-insights-model')).toBeTruthy();
    expect(res.text).toBe('The mug is mostly electricity.');

    const call = outbound.calls.find((c) => c.url === 'https://router.huggingface.co/v1/chat/completions')!;
    const sent = JSON.parse(call.body!);
    expect(sent).toMatchObject({ stream: true, max_tokens: 400 });
    expect(sent.messages[1].content).toContain('Mold Cleaning');
    expect(sent.messages[1].content).toContain('6.09');
  });

  it('sends a reply whose numbers all come from the facts, marked as checked', async () => {
    mockOutbound(/router\.huggingface\.co/, () =>
      hfStream(['Mold Cleaning is 58.1% of the 6.09 kg CO2 eq', ', so start there.']),
    );
    const res = await api.post('/api/insights', { token: u.token, json: facts() });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-insights-checked')).toBe('numbers');
    expect(res.text).toBe('Mold Cleaning is 58.1% of the 6.09 kg CO2 eq, so start there.');
  });

  it('drops a reply with a number the facts do not hold, and the client shows the computed insight', async () => {
    mockOutbound(/router\.huggingface\.co/, () =>
      hfStream(['Cleaning is about 60% of the total; a new mold saves 25%.']),
    );
    const res = await api.post('/api/insights', { token: u.token, json: facts() });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ fallback: true, reason: 'number check failed' });
  });

  it('an upstream failure falls back to the computed insight (200 {fallback:true})', async () => {
    mockOutbound(/router\.huggingface\.co/, () => new Response('upstream exploded: secret stack', { status: 500 }));
    const res = await api.post('/api/insights', { token: u.token, json: facts() });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ fallback: true, reason: 'HF 500' });
  });

  it('413 for a body over 16 KB, declared or streamed; 400 for a question over 500 characters', async () => {
    const big = JSON.stringify({ ...facts(), question: 'x'.repeat(17 * 1024), mode: 'custom' });
    const declared = await api.post('/api/insights', { token: u.token, raw: big, headers: { 'content-length': String(big.length) } });
    expect(declared.status).toBe(413);
    expect(declared.json.fallback).toBe(true);
    const streamed = await api.post('/api/insights', { token: u.token, raw: big });
    expect(streamed.status).toBe(413);

    const long = await api.post('/api/insights', { token: u.token, json: { ...facts(), mode: 'custom', question: 'q'.repeat(501) } });
    expect(long.status).toBe(400);
    expect(long.json).toMatchObject({ fallback: true, error: 'question must be at most 500 characters' });
    const ok = await api.post('/api/insights', { token: u.token, json: { ...facts(), mode: 'custom', question: 'q'.repeat(500) } });
    expect(ok.status).toBe(200);
    expect(outbound.calls.filter((c) => c.url.includes('huggingface'))).toHaveLength(1);

    for (const body of [{ ...facts(), mode: 'poem' }, { ...facts(), contributors: 'all' }, { ...facts(), total: { value: 'lots' } }]) {
      const r = await api.post('/api/insights', { token: u.token, json: body });
      expect(r.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
  });

  it('the 21st call in an hour gets 429 with Retry-After; other users are not affected', async () => {
    // Twenty different questions: a repeated one is answered from the cache
    // and uses none of the allowance.
    const ask = (i: number) => ({ ...facts(), mode: 'custom', question: `Question ${i}` });
    for (let i = 0; i < 20; i++) {
      mockOutbound(/router\.huggingface\.co/, () => hfStream(['ok']));
      const r = await api.post('/api/insights', { token: u.token, json: ask(i) });
      expect(r.status, `call ${i + 1}`).toBe(200);
    }
    const limited = await api.post('/api/insights', { token: u.token, json: ask(20) });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(limited.headers.get('x-ratelimit-limit')).toBe('20');
    expect(limited.json.fallback).toBe(true);
    expect(outbound.calls.filter((c) => c.url.includes('huggingface'))).toHaveLength(20);

    const other = await createUser('f11other');
    const otherRun = await ownRun(other);
    expect((await api.post('/api/insights', { token: other.token, json: { ...FACTS, run_id: otherRun } })).status).toBe(200);
  });

  it('401 without a token', async () => {
    const res = await api.post('/api/insights', { json: facts() });
    expect(res.status).toBe(401);
  });
});
