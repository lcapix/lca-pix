/**
 * Rate limits (H5) through the real routes, with the in-memory store reset
 * before each test (setup.ts). Each limit: the last allowed call succeeds,
 * the next is 429 with Retry-After and X-RateLimit-* headers, and another
 * caller (IP, email or user, as the key says) is unaffected.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { freshIp, type ApiResponse } from '../support/http';
import { createUser, makePlatformAdmin, newPassword, uniqueEmail, type TestUser } from '../support/users';
import { addFlow, createCase, createComponent, createProject } from '../support/world';
import { sqlOne } from '../support/db';

function expect429(res: ApiResponse, limit: number) {
  expect(res.status, res.text).toBe(429);
  const retry = Number(res.headers.get('retry-after'));
  expect(Number.isInteger(retry) && retry >= 1).toBe(true);
  expect(res.headers.get('x-ratelimit-limit')).toBe(String(limit));
  expect(res.headers.get('x-ratelimit-remaining')).toBe('0');
  expect(res.json.retry_after).toBe(retry);
}

let u: TestUser;
let other: TestUser;
beforeAll(async () => {
  [u, other] = await Promise.all([createUser('rl'), createUser('rlother')]);
});

describe('rate limits', () => {
  it('login: 5 per minute per IP + email; the 6th is 429 even with the right password', async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i++) {
      const r = await api.post('/api/auth/login', { json: { email: u.email, password: 'Wrong-password-1' }, ip });
      expect(r.status).toBe(401);
    }
    const sixth = await api.post('/api/auth/login', { json: { email: u.email, password: u.password }, ip });
    expect429(sixth, 5);
    expect(sixth.json.token).toBeUndefined();
    // Another email from the same IP, and the same email from another IP, still work.
    expect((await api.post('/api/auth/login', { json: { email: other.email, password: other.password }, ip })).status).toBe(200);
    expect((await api.post('/api/auth/login', { json: { email: u.email, password: u.password }, ip: freshIp() })).status).toBe(200);
    // The key is case-insensitive: shouting the email does not reset it.
    expect((await api.post('/api/auth/login', { json: { email: u.email.toUpperCase(), password: u.password }, ip })).status).toBe(429);
  });

  it('signup: 3 per hour per IP; the 4th is 429 and creates nothing', async () => {
    const ip = freshIp();
    for (let i = 0; i < 3; i++) {
      expect((await api.post('/api/auth/signup', { json: { email: uniqueEmail('rlsign'), password: newPassword() }, ip })).status).toBe(201);
    }
    const email = uniqueEmail('rlsign4');
    expect429(await api.post('/api/auth/signup', { json: { email, password: newPassword() }, ip }), 3);
    expect(await sqlOne('SELECT id FROM account WHERE email = ?', [email])).toBeUndefined();
    expect((await api.post('/api/auth/signup', { json: { email, password: newPassword() }, ip: freshIp() })).status).toBe(201);
  });

  it('insights: 20 per hour per user (with a model key)', async () => {
    process.env.HF_TOKEN = 'hf_test_dummy_token';
    try {
      const facts = { caseName: 'x', method: 'CML 2001', categoryLabel: 'Global Warming', contributors: [], mode: 'summary' };
      for (let i = 0; i < 20; i++) expect((await api.post('/api/insights', { token: u.token, json: facts })).status).toBe(200);
      expect429(await api.post('/api/insights', { token: u.token, json: facts }), 20);
      expect((await api.post('/api/insights', { token: other.token, json: facts })).status).toBe(200);
    } finally {
      delete process.env.HF_TOKEN;
    }
  });

  it('ingest preview: 10 per hour per user', async () => {
    const form = () => {
      const fd = new FormData();
      fd.append('file', new File(['Part,Material,Mass (kg)\nBody,Steel,0.35\n'], 'bom.csv'));
      fd.append('connector', 'bom');
      return fd;
    };
    for (let i = 0; i < 10; i++) expect((await api.post('/api/ingest/preview', { token: u.token, form: form() })).status).toBe(200);
    expect429(await api.post('/api/ingest/preview', { token: u.token, form: form() }), 10);
    expect((await api.post('/api/ingest/preview', { token: other.token, form: form() })).status).toBe(200);
  });

  it('assessments: 30 runs per hour per user; the 31st is 429 and records no run', async () => {
    const pid = await createProject(u, `RL runs ${u.id}`);
    const caseId = await createCase(u, pid, 'Runs');
    const step = await createComponent(u, caseId, { component_name: 'Step', component_type: 'product' });
    const electricity = Number((await sqlOne(`SELECT substance_id FROM substances WHERE substance_name = 'Electricity'`)).substance_id);
    await addFlow(u, step, { substance_id: electricity, flow_type: 'input', quantity: 1, unit: 'kWh' });
    for (let i = 0; i < 30; i++) expect((await api.post(`/api/cases/${caseId}/assessments`, { token: u.token, json: {} })).status, `run ${i + 1}`).toBe(201);
    const before = await sqlOne('SELECT COUNT(*) AS n FROM assessment_runs WHERE case_id = ?', [caseId]);
    expect429(await api.post(`/api/cases/${caseId}/assessments`, { token: u.token, json: {} }), 30);
    expect(await sqlOne('SELECT COUNT(*) AS n FROM assessment_runs WHERE case_id = ?', [caseId])).toEqual(before);
  });

  it('PubChem enrichment: 5 per hour per platform admin', async () => {
    const admin = await createUser('rladmin');
    await makePlatformAdmin(admin);
    for (let i = 0; i < 5; i++) {
      expect((await api.post('/api/integrations/pubchem/enrich', { token: admin.token, json: { only_missing: true, limit: 1 } })).status).toBe(200);
    }
    expect429(await api.post('/api/integrations/pubchem/enrich', { token: admin.token, json: { only_missing: true, limit: 1 } }), 5);
  });

  it('cost lookups: 60 per hour per user, shared by BLS, EIA and Metals; the 61st is 429', async () => {
    const calls: Array<[string, unknown]> = [
      ['/api/integrations/bls/fetch-wage', { occupation: '51-4121', state: 'US' }],
      ['/api/integrations/eia/fetch-energy-price', { fuel: 'electricity', state: 'NC' }],
      ['/api/integrations/metals/fetch-price', { symbol: 'STL' }],
    ];
    for (let i = 0; i < 60; i++) {
      const [url, json] = calls[i % 3];
      expect((await api.post(url, { token: u.token, json })).status, `lookup ${i + 1}`).toBe(200);
    }
    for (const [url, json] of calls) expect429(await api.post(url, { token: u.token, json }), 60);
    expect((await api.post(calls[0][0], { token: other.token, json: calls[0][1] })).status).toBe(200);
  });
});
