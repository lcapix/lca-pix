/**
 * F2. Log in and log out (email), at the API level: POST /api/auth/login,
 * GET /api/auth/me, POST /api/auth/logout, and what ends a session.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { api } from '../support/api';
import { freshIp, setCookies } from '../support/http';
import { changePasswordHash, createUser, deactivate, type TestUser } from '../support/users';

const login = (email: unknown, password: unknown) => api.post('/api/auth/login', { json: { email, password }, ip: freshIp() });

let u: TestUser;
beforeAll(async () => {
  u = await createUser('f2');
});

describe('F2 log in and log out', () => {
  it('logs in, works, logs out; the logout expires the cookies', async () => {
    const res = await login(u.email, u.password);
    expect(res.status).toBe(200);
    expect(res.json.user).toMatchObject({ id: u.id, email: u.email, account_type: 'user' });
    const payload = jwt.decode(res.json.token) as any;
    expect(payload).toMatchObject({ id: u.id, email: u.email });
    expect(payload.pv).toMatch(/^[0-9a-f]{16}$/);

    const me = await api.get('/api/auth/me', { token: res.json.token });
    expect(me.status).toBe(200);
    expect(me.json.user).toMatchObject({ id: u.id, email: u.email, is_active: 1 });
    expect(me.text).not.toContain('password');

    const out = await api.post('/api/auth/logout', { token: res.json.token });
    expect(out.status).toBe(200);
    expect(out.headers.get('cache-control')).toBe('no-store');
    const c = setCookies(out.headers);
    expect(Object.keys(c).sort()).toEqual(['auth_token', 'user_data']);
    for (const cookie of Object.values(c)) {
      expect(cookie.value).toBe('');
      expect(cookie.attrs).toContain('max-age=0');
      expect(cookie.attrs).toContain('path=/');
      expect(cookie.attrs).toContain('httponly');
      expect(cookie.attrs).toContain('samesite=lax');
    }
    // Documented: the bearer JWT is not revoked by logout (no per-session revocation).
    expect((await api.get('/api/auth/me', { token: res.json.token })).status).toBe(200);
  });

  it('answers a wrong password and an unknown email identically', async () => {
    const wrong = await login(u.email, 'Definitely-wrong-1');
    const unknown = await login(`nobody.${Date.now()}@lcapix.test`, 'Definitely-wrong-1');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.text).toBe(wrong.text);
    expect(wrong.json).toEqual({ error: 'Invalid email or password' });
  });

  it('400 for missing or non-string credentials', async () => {
    for (const [email, password] of [
      [undefined, 'x'],
      [u.email, undefined],
      ['', 'x'],
      [{ $ne: null }, 'x'],
      [u.email, ['x']],
    ]) {
      const r = await login(email, password);
      expect(r.status, JSON.stringify([email, password])).toBe(400);
    }
  });

  it('a deactivated account: 403 only after the correct password, and its token is refused', async () => {
    const d = await createUser('f2dee');
    await deactivate(d);
    const right = await login(d.email, d.password);
    expect(right.status).toBe(403);
    expect(right.json.error).toBe('Account is inactive. Please contact support.');
    const wrong = await login(d.email, 'Definitely-wrong-1');
    expect(wrong.status).toBe(401);
    expect(wrong.json).toEqual({ error: 'Invalid email or password' });
    expect((await api.get('/api/projects', { token: d.token })).status).toBe(401);
    expect((await api.get('/api/auth/me', { token: d.token })).status).toBe(401);
  });

  it('a password change revokes every earlier token (pv)', async () => {
    const r = await createUser('f2pw');
    const before = r.token;
    expect((await api.get('/api/projects', { token: before })).status).toBe(200);
    await changePasswordHash(r);
    const after = await api.get('/api/projects', { token: before });
    expect(after.status).toBe(401);
    expect(after.json).toEqual({ error: 'Unauthorized' });
    // The new password signs in and its token works.
    const fresh = await login(r.email, r.password);
    expect(fresh.status).toBe(200);
    expect((await api.get('/api/projects', { token: fresh.json.token })).status).toBe(200);
  });
});
