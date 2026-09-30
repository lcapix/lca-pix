/**
 * Bearer tokens that must be refused with 401 (never 500, never data):
 * wrong secret, alg=none, HS512, expired, missing or wrong pv, pv after a
 * password change, a forged id, malformed headers, a deleted account.
 * Checked on a project read, a write and the integrations guards.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { api } from '../support/api';
import { sql } from '../support/db';
import { changePasswordHash, createUser, tokenPayload, type TestUser } from '../support/users';
import { createProject } from '../support/world';

const SECRET = 'test-secret-do-not-use-in-prod';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

let u: TestUser;
let pid: number;
beforeAll(async () => {
  u = await createUser('jwt');
  pid = await createProject(u, `JWT target ${u.id}`);
});

async function refused(token: string, label: string) {
  const reads = [
    await api.get(`/api/projects/${pid}`, { token }),
    await api.get('/api/projects', { token }),
    await api.get('/api/auth/profile', { token }),
    await api.get('/api/integrations/log', { token }),
    await api.post('/api/integrations/bls/fetch-wage', { token, json: { occupation: '51-4121', state: 'US' } }),
  ];
  for (const r of reads) {
    expect(r.status, `${label}: ${r.text.slice(0, 120)}`).toBe(401);
    expect(r.text).not.toContain(`JWT target ${u.id}`);
  }
  const write = await api.put(`/api/projects/${pid}`, { token, json: { description: `hacked by ${label}` } });
  expect(write.status, label).toBe(401);
  expect((await api.get('/api/auth/me', { token })).status, label).toBe(401);
}

describe('JWT refusal', () => {
  it('the real token works (control)', async () => {
    expect((await api.get(`/api/projects/${pid}`, { token: u.token })).status).toBe(200);
  });

  it('wrong secret', async () => {
    const p = tokenPayload(u);
    await refused(jwt.sign({ id: u.id, email: u.email, pv: p.pv }, 'not-the-secret', { algorithm: 'HS256' }), 'wrong secret');
  });

  it('alg=none (unsigned)', async () => {
    const p = tokenPayload(u);
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: u.id, email: u.email, pv: p.pv, iat: Math.floor(Date.now() / 1000) })}.`;
    await refused(token, 'alg none');
  });

  it('HS512 with the right secret (only HS256 is accepted)', async () => {
    const p = tokenPayload(u);
    await refused(jwt.sign({ id: u.id, email: u.email, pv: p.pv }, SECRET, { algorithm: 'HS512' }), 'HS512');
  });

  it('expired', async () => {
    const p = tokenPayload(u);
    const token = jwt.sign({ id: u.id, email: u.email, pv: p.pv, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, { algorithm: 'HS256' });
    await refused(token, 'expired');
  });

  it('missing pv, and a pv that does not match the hash', async () => {
    await refused(jwt.sign({ id: u.id, email: u.email }, SECRET, { algorithm: 'HS256', expiresIn: '1h' }), 'no pv');
    await refused(jwt.sign({ id: u.id, email: u.email, pv: '0123456789abcdef' }, SECRET, { algorithm: 'HS256', expiresIn: '1h' }), 'bad pv');
  });

  it("another user's valid pv on this user's id (forged id)", async () => {
    const other = await createUser('jwtother');
    const token = jwt.sign({ id: u.id, email: u.email, pv: tokenPayload(other).pv }, SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    await refused(token, 'forged id');
  });

  it('a signed payload edited after signing (id swapped, signature kept)', async () => {
    const [h, , s] = u.token.split('.');
    const other = await createUser('jwtvictim');
    const forged = `${h}.${b64({ ...tokenPayload(u), id: other.id })}.${s}`;
    await refused(forged, 'edited payload');
  });

  it('pv after a password change: every earlier token is revoked', async () => {
    const v = await createUser('jwtpw');
    const old = v.token;
    await changePasswordHash(v);
    const r = await api.get('/api/projects', { token: old });
    expect(r.status).toBe(401);
  });

  it('a token for a deleted account', async () => {
    const gone = await createUser('jwtgone');
    await sql('DELETE FROM account WHERE id = ?', [gone.id]);
    await refused(gone.token, 'deleted account');
  });

  it('malformed Authorization headers', async () => {
    for (const header of ['Bearer', 'Bearer ', 'Bearer a.b.c', `Basic ${Buffer.from('a:b').toString('base64')}`, `bearer ${u.token}`, `Bearer ${u.token}x`]) {
      const r = await api.get(`/api/projects/${pid}`, { headers: { authorization: header } });
      expect(r.status, header.slice(0, 20)).toBe(401);
    }
  });
});
