/**
 * F11. Magic Insights, AI mode: POST /api/insights with the Hugging Face
 * router mocked. The stream starts with a role-only delta, a reasoning-only
 * delta and a keep-alive (what stalled INS-1); the text must still arrive.
 * Limits: 16 KB body, 500-character question, 20 calls per user per hour.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { hfStream, mockOutbound, outbound } from '../support/outbound';
import { createUser, type TestUser } from '../support/users';

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

let u: TestUser;
beforeAll(async () => {
  u = await createUser('f11');
});
beforeEach(() => {
  process.env.HF_TOKEN = 'hf_test_dummy_token';
});
afterEach(() => {
  delete process.env.HF_TOKEN;
});

describe('F11 Magic Insights (AI mode)', () => {
  it('without HF_TOKEN: 200 {fallback:true}, and nothing leaves the server', async () => {
    delete process.env.HF_TOKEN;
    const res = await api.post('/api/insights', { token: u.token, json: FACTS });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ fallback: true, reason: 'HF_TOKEN not configured' });
    expect(outbound.calls).toEqual([]);
  });

  it('streams the narration past role-only, reasoning-only and keep-alive events (INS-1 fixed)', async () => {
    const res = await api.post('/api/insights', { token: u.token, json: FACTS });
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

  it('an upstream failure falls back to the computed insight (200 {fallback:true})', async () => {
    mockOutbound(/router\.huggingface\.co/, () => new Response('upstream exploded: secret stack', { status: 500 }));
    const res = await api.post('/api/insights', { token: u.token, json: FACTS });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ fallback: true, reason: 'HF 500' });
  });

  it('413 for a body over 16 KB, declared or streamed; 400 for a question over 500 characters', async () => {
    const big = JSON.stringify({ ...FACTS, question: 'x'.repeat(17 * 1024), mode: 'custom' });
    const declared = await api.post('/api/insights', { token: u.token, raw: big, headers: { 'content-length': String(big.length) } });
    expect(declared.status).toBe(413);
    expect(declared.json.fallback).toBe(true);
    const streamed = await api.post('/api/insights', { token: u.token, raw: big });
    expect(streamed.status).toBe(413);

    const long = await api.post('/api/insights', { token: u.token, json: { ...FACTS, mode: 'custom', question: 'q'.repeat(501) } });
    expect(long.status).toBe(400);
    expect(long.json).toMatchObject({ fallback: true, error: 'question must be at most 500 characters' });
    const ok = await api.post('/api/insights', { token: u.token, json: { ...FACTS, mode: 'custom', question: 'q'.repeat(500) } });
    expect(ok.status).toBe(200);
    expect(outbound.calls.filter((c) => c.url.includes('huggingface'))).toHaveLength(1);

    for (const body of [{ ...FACTS, mode: 'poem' }, { ...FACTS, contributors: 'all' }, { ...FACTS, total: { value: 'lots' } }]) {
      const r = await api.post('/api/insights', { token: u.token, json: body });
      expect(r.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
  });

  it('the 21st call in an hour gets 429 with Retry-After; other users are not affected', async () => {
    for (let i = 0; i < 20; i++) {
      mockOutbound(/router\.huggingface\.co/, () => hfStream(['ok']));
      const r = await api.post('/api/insights', { token: u.token, json: FACTS });
      expect(r.status, `call ${i + 1}`).toBe(200);
    }
    const limited = await api.post('/api/insights', { token: u.token, json: FACTS });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(limited.headers.get('x-ratelimit-limit')).toBe('20');
    expect(limited.json.fallback).toBe(true);
    expect(outbound.calls.filter((c) => c.url.includes('huggingface'))).toHaveLength(20);

    const other = await createUser('f11other');
    expect((await api.post('/api/insights', { token: other.token, json: FACTS })).status).toBe(200);
  });

  it('401 without a token', async () => {
    const res = await api.post('/api/insights', { json: FACTS });
    expect(res.status).toBe(401);
  });
});
